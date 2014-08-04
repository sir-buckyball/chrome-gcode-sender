/**
 * A service for interacting with a CNC machine.
 */
app.service('machineService', function($rootScope, warningService) {
  // TODO: make this configurable.
  // NOTE: A scrollback of 1000 causes chromebooks to stutter once full.
  var CONSOLE_MAX_SCROLLBACK = 120;

  var connectionId = null;

  var connect = function(port, baud) {
    api.isBusy = true;

    var options = {
      "bitrate":baud,
      "ctsFlowControl":false,
      "dataBits":"eight",
      "parityBit":"no",
      "stopBits":"one"
    };
    console.log("connecting to '" + port + "' with options: " + JSON.stringify(options));
    chrome.serial.connect(port, options, function(info) {
      if (!info) {
        warningService.warn("connection", "Unable to connect to '" + port + "'");
        api.isBusy = false;
        api.isConnected = false;
        $rootScope.$apply();
        return;
      }
      console.log("serial connection obtained:\n" + JSON.stringify(info));

      for (var k in options) {
        if (options[k] != info[k]) {
          warningService.warn("connection", "Chrome did not use requested serial connection option. [" +
              k + "; expected:" + options[k] + ", actual:" + info[k] + "]");
        }
      }

      connectionId = info.connectionId;
      api.isBusy = false;
      api.isConnected = true;
      api.commandQueue = [];
      api.pendingAck = false;
      $rootScope.$apply();

      // Don't fall asleep while controlling a machine.
      chrome.power.requestKeepAwake("system");
    });
  };

  var disconnect = function() {
    // If we're disconnected, we don't need to keep the system awake.
    chrome.power.releaseKeepAwake();

    // It's misleading to think the command queue will be applied on reconnect.
    api.commandQueue = [];

    // fast user feedback that something happened.
    if (connectionId) {
      console.log("disconnecting connection " + connectionId);
      api.isBusy = true;
      chrome.serial.disconnect(connectionId, function(result) {
        connectionId = null;
        api.isConnected = false;
        api.isBusy = false;
        $rootScope.$apply();
      });
    }
  };

  var enqueueCommands = function(cmds) {
    for (var i = 0; i < cmds.length; i++) {
      api.commandQueue.push(cmds[i]);
    }
  }

  /**
   * Convert a string to an ArrayBuffer.
   */
  var str2ab = function(str) {
    var buf = new ArrayBuffer(str.length);
    var bufView = new Uint8Array(buf);
    for (var i = 0; i < str.length; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return buf;
  };

  /**
   * Convert an ArrayBuffer to a string.
   */
  var ab2str = function(buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
  };

  /**
   * Ensure a string is human readable by rendering all non-printable characters
   * with a hex escaping.
   */
  function makeHumanReadable(str) {
    var parts = [];
    for (var j = 0; j < str.length; j++) {
      var d = str.charCodeAt(j);
      if (d < 32) {
        parts.push("\\x" + d.toString(16));
      } else {
        parts.push(str.charAt(j));
      }
    }
    return parts.join("");
  }

  var incomingCommandLookbackChar = '';

  /**
   * Log a command to the console display.
   *
   * @param {string} cmd The command that was sent or received
   * @param {bool} isSend True if the message was outgoing
   */
  var logCommand = function(cmd, isSend) {
    // Determine the node to add the incoming text to. Since incoming text
    // can be broken into multiple calls to this funciton, we want to join
    // blocks and only split when we detect interleving or a newline.
    var nodeToWriteTo;
    var lastChild = api.logs[api.logs.length - 1];
    if (!isSend && lastChild && lastChild.remoteSource
        && incomingCommandLookbackChar != "\n") {
      // incoming data may be split, so grab the last element instead of a new one.
      nodeToWriteTo = lastChild;
    } else if (lastChild && !lastChild.msg) {
      lastChild.remoteSource = !isSend;
      nodeToWriteTo = lastChild;
    } else {
      nodeToWriteTo = {remoteSource: !isSend, msg: ""}
      api.logs.push(nodeToWriteTo);
    }

    // For commands received, we want to look for an 'ok' to clear
    // our command block.
    if (!isSend) {
      // The lookback character is needed because the 2 byte 'ok' can be split.
      if ((incomingCommandLookbackChar + cmd).indexOf("ok") != -1) {
        api.pendingAck = false;
      }
      if (cmd.length > 0) {
        incomingCommandLookbackChar = cmd.charAt(cmd.length - 1);
      }
    }

    // Add each line to the console output.
    lines = cmd.split("\n");
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      line = line.replace("\r", "");
      nodeToWriteTo.msg = nodeToWriteTo.msg + makeHumanReadable(line);

      // Tag nodes which are just an ack.
      if (!isSend) {
        nodeToWriteTo.isAck = (nodeToWriteTo.msg == "ok");
      }

      if (i < lines.length - 1) {
        nodeToWriteTo = {remoteSource: !isSend, msg: ""}
        api.logs.push(nodeToWriteTo);
      }
    }

    // Limit our history (it could be megs of data when processing a file).
    while (api.logs.length > CONSOLE_MAX_SCROLLBACK) {
      api.logs.shift();
    }
  }

  /**
   * Send a command to an active serial connection.
   */
  var sendCommandToSerialConnection = function(cmd) {
    if (cmd.indexOf("G90") != -1) {
      api.isRelativeMode = false;
    } else if (cmd.indexOf("G91") != -1) {
      api.isRelativeMode = true;
    } else if (cmd.indexOf("G20") != -1) {
      api.isMm = false;
    } else if (cmd.indexOf("G21") != -1) {
      api.isMm = true;
    }

    // make sure we have a device available.
    if (!connectionId) {
      warningService.warn("cmd", "no device connection available.");
      return;
    }

    // Actually send the command.
    chrome.serial.send(connectionId, str2ab(cmd + "\n"), function(info) {
      if (info.error) {
        warningService.warn("cmd", "failed to send command: " + info.error);
      }
    });

    logCommand(cmd, true);
  }

  /**
   * Process one element of the command queue.
   */
  var processCommandQueue = function() {
    // Only process the queue if we are connected.
    // Don't process anymore commands until we have received an 'ok' from the workspace.
    if (api.commandQueue.length === 0 || !connectionId || api.pendingAck) {
      return;
    }

    // Pop the first element off the queue and send it to the serial line.
    api.pendingAck = true;
    sendCommandToSerialConnection(api.commandQueue.shift());
    $rootScope.$apply();
  }

  // Process an element from the command queue every few ms.
  window.setInterval(processCommandQueue, 50);

  // Configure the console panel to display incoming messages.
  chrome.serial.onReceive.addListener(function(info) {
    logCommand(ab2str(info.data), false);
    $rootScope.$apply();
  });

  // Log errors
  chrome.serial.onReceiveError.addListener(function(info) {
    warningService.warn("connection", "error with serial communication: " + info.error);
    $rootScope.$apply();
  });

  /**
   * Perform an emergency machine stop. This will send a M112 command, clear the
   * command queue, and disconnect from the machine.
   *
   * Per documentation, the machine will likely need to be manually reset on
   * the controller board before it can be used again.
   */
  var emergencyStop = function() {
    console.error("!!!emergency stop activated!!!");

    // Clear the command queue.
    api.commandQueue = [];

    // Send the command to perform an emergency stop.
    sendCommandToSerialConnection("M112", true);

    // Send an ascii cancel command.
    sendCommandToSerialConnection("\x18", true);
  }

  // Return the "API" for this service.
  var api = {
    isBusy:false,
    isConnected:false,
    isRelativeMode: false,
    isMm: false,
    pendingAck:false,
    logs:[],
    commandQueue:[],
    connect:connect,
    disconnect:disconnect,
    enqueueCommands:enqueueCommands,
    emergencyStop:emergencyStop
  };
  return api;
});
