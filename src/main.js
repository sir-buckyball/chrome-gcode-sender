// author: Buck Clay (dev@buckclay.com)
// date: 2013-12-25

// The commands listed in the currently-loaded file.
window.commandSequence = [];

// The commands to be sent over to a connected machine for execution.
window.workspaceCommandQueue = [];

// Default settings for the user to configure. This will be updated from perisstence.
window.settings = {
  "workspace-width-mm": 150,
  "workspace-depth-mm": 150,
  "workspace-height-mm": 50,
  "workspace-port": "",
  "workspace-baud": 115200
};

// A flag used for determining if we are waiting for an ok from the workspace.
window.workspacePendingAck = false;
window.workspaceIsRelativeMode = false;
window.workspaceIsMm = false;

// Warnings which should be displayed to the user.
window.userWarnings = {};

// The history of manual commands that the user has entered.
window.manualInputHistory = [];
window.manualInputPosition = 0;

// TODO: make this configurable.
var CONSOLE_MAX_SCROLLBACK = 1000;

/**
 * Display a warning to the user. Messages are grouped so
 * they can be cleared when the condition no longer applies.
 *
 * @param {string} group The group the warning belongs to
 * @param {string} msg The message of the warning
 */
function showWarning(group, msg) {
  console.warn(msg);

  if (!window.userWarnings[group]) {
    window.userWarnings[group] = [];
  }
  window.userWarnings[group].push(msg);
  renderUserWarnings();
}

function clearWarningGroup(group) {
  delete window.userWarnings[group];
  renderUserWarnings();
}

function renderUserWarnings() {
  $("#warnings-user").html("");
  for (var g in window.userWarnings) {
    var d = $('<div class="alert alert-warning alert-dismissable"></div>');
    d.append($('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>'));
    for (var i = 0; i < window.userWarnings[g].length; i++) {
      $("<div/>", {"text": window.userWarnings[g][i]}).appendTo(d);
    }
    d.appendTo("#warnings-user");
  }
  $("#warnings-user").show();
}

function handleFileSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  var files;
  if (evt.target.files) {
    files = evt.target.files; // FileList object
  } else if (evt.dataTransfer) {
    files = evt.dataTransfer.files; // FileList object.
  } else {
    console.log("unknown file input");
  }

  // only examine the first file.
  var f = files[0];
  $("#render-canvas-heading").html($("<strong/>").text(f.name));
  $("#render-canvas-heading").append($("<small/>").text(
      " (last modified " + moment(f.lastModifiedDate).fromNow() + ")"));

  if (files.length > 0) {
    processFile(files[0]);
  } else {
    console.log("input file had no content.");
  }
}

function processFile(f) {
  // TODO: don't read binary files.

  console.log("processing file: " + f.name);
  var reader = new FileReader();
  reader.onloadend = function(evt) {
    if (evt.target.readyState == FileReader.DONE) {
      console.log("done reading file");

      var start;
      console.log("begin parsing gcode");
      start = moment();
      window.commandSequence = extractCommandSequence(evt.target.result);
      console.log("end parsing gcode (" + moment.duration(moment() - start).toIsoString() + ")");

      console.log("begin rendering");
      start = moment();
      renderGcode(commandSequence);
      console.log("end rendering (" + moment.duration(moment() - start).toIsoString() + ")");
    }
  };
  reader.readAsText(f);
}

/* Break a string of gcode text into a sequence of commands. */
function extractCommandSequence(text) {
  // Break the raw text into a command sequence.
  var commandSequence = [];
  var currentCommand = [];
  var inSemicolonComment = false;
  var inParenComment = false;
  for (var i = 0; i < text.length; i++) {
    // Deal with comments in the file.
    var c = text[i];
    if (inSemicolonComment) {
      if (c == "\n") {
        inSemicolonComment = false;
      }
      continue;
    } else if (c == ";") {
      inSemicolonComment = true;
      continue;
    }

    if (inParenComment) {
      if (c == ")") {
        inParenComment = false;
      }
      continue;
    } else if (c == "(") {
      inParenComment = true;
      continue;
    }

    // Check for the start of a new command.
    if (c == "G" || c == "M") {
      currentCommand = currentCommand.join("").trim().toUpperCase();
      if (currentCommand.length > 0) {
        commandSequence.push(currentCommand);
      }
      currentCommand = [];
    }

    // Skip existing newlines.
    if (c == "\n" || c == "\t") {
      c = " ";
    }

    // Copy each character over.
    currentCommand.push(c);
  }

  // Don't forget about the very last command.
  currentCommand = currentCommand.join("").trim().toUpperCase();
  if (currentCommand.length > 0) {
    commandSequence.push(currentCommand);
  }
  currentCommand = [];

  return commandSequence;
}

/* Render the list of gcode commands onto a canvas. */
function renderGcode(commandSequence) {
  // Clear out any previous paths.
  paper.project.activeLayer.removeChildren();

  var settings = window.settings;

  // Initialize our state variables.
  var warnings = {};

  // try to render in real size (default to mm)
  var viewWidth = $("#render-canvas-holder").width();
  var viewHeight = chrome.app.window.current().getBounds().height -
      $("#render-canvas-holder").position().top - 18;
  var scale = Math.min(
      viewWidth / settings["workspace-width-mm"],
      viewHeight / settings["workspace-depth-mm"]);

  // A toggle for absolute v. relative coordinate specification.
  var isRelative = false;

  // A toggle for inch v. millimeter coordinate specification.
  var isInches = false;

  var workspace = {
    "X": settings["workspace-width-mm"] * scale,
    "Y": settings["workspace-depth-mm"] * scale,
    "Z": settings["workspace-height-mm"] * scale
  };

  var pos = {
    "X": 0,
    "Y": 0,
    "Z": 0
  };

  // draw a little table representing out workspace.
  new paper.Path.Rectangle({
    "point": [0, 0],
    "size": [workspace["X"], workspace["Y"]],
    "strokeColor": "#B8E6E6"
  });
  for (var i = 0; i < workspace["X"]; i += 5 * scale) {
    new paper.Path.Line({
      "from": [i, 0],
      "to": [i, workspace["Y"]],
      "strokeColor": "#CCFFFF"
    });
  }
  for (var i = 0; i < workspace["Y"]; i += 5 * scale) {
    new paper.Path.Line({
      "from": [0, i],
      "to": [workspace["X"], i],
      "strokeColor": "#CCFFFF"
    });
  }

  var path = null;
  for (var i = 0; i < commandSequence.length; i++) {
    var command = commandSequence[i];
    var parts = command.split(" ");

    var cType = parts[0][0];
    var cNum = parseInt(parts[0].substr(1), 10);

    // Read the command parameters.
    var params = {};
    for (var j = 1; j < parts.length; j++) {
      params[parts[j][0].toUpperCase()] = parseFloat(parts[j].substr(1)) || 0;
    }

    if (!(cType == "G" && (cNum == 1 || cNum == 2 || cNum == 3))) {
      path = null;
    }

    if (cType == "G" && (cNum == 0 || cNum == 1)) {
      var endX = ((isRelative || params["X"] == undefined) ? pos["X"] : 0) +
          ((params["X"] == undefined) ? 0 : params["X"] * scale);
      var endY = ((isRelative || params["Y"] == undefined) ? pos["Y"] : 0) +
          ((params["Y"] == undefined) ? 0 : params["Y"] * scale);

      // rapid move | linear interpolation
      var start = new paper.Point(pos["X"], pos["Y"]);
      var end = new paper.Point(endX, endY);

      // create a new path if one is not already available.
      if (!path) {
        var path = new paper.Path();
        path.strokeColor = 'black';
        if (cNum == 0) {
          path.dashArray = [1, 2];
        }
        path.moveTo(new paper.Point(start.x, workspace["Y"] - start.y));
      }
  
      path.lineTo(new paper.Point(end.x, workspace["Y"] - end.y));

      // Update our known position.
      pos["X"] = end.x;
      pos["Y"] = end.y;

      // Don't join rapid move segments since they have a different style than other lines.
      if (cNum == 0) {
        path = null;
      }
    } else if (cType == "G" && (cNum == 2 || cNum == 3)) {
      if (params["I"] == undefined || params["J"] == undefined) {
        msg = "implementation only supports specification of both I and J: " + command;
        warnings[msg] = (warnings[msg] || 0) + 1;
        continue;
      }

      // circular interpolation (clockwise)
      var clockwise = (cNum == 2);

      var endX = ((isRelative || params["X"] == undefined) ? pos["X"] : 0) +
          ((params["X"] == undefined) ? 0 : params["X"] * scale);
      var endY = ((isRelative || params["Y"] == undefined) ? pos["Y"] : 0) +
          ((params["Y"] == undefined) ? 0 : params["Y"] * scale);

      // TODO: implement missing axii (Z, A, B, C, K)
      var start = new paper.Point(pos["X"], pos["Y"]);
      var end = new paper.Point(endX, endY);

      var center = start.add(new paper.Point(params["I"] * scale, params["J"] * scale));
      var through = start.subtract(center);
      through.angle = start.add(end).subtract(center).subtract(center).angle;
      through = through.add(center);

      if (!path) {
        var path = new paper.Path();
        path.strokeColor = 'black';
        path.moveTo(new paper.Point(start.x, workspace["Y"] - start.y));
      }
      path.arcTo(
        new paper.Point(through.x, workspace["Y"] - through.y),
        new paper.Point(end.x, workspace["Y"] - end.y));

      // Update our known position.
      pos["X"] = end.x;
      pos["Y"] = end.y;
    } else if (cType == "G" && cNum == 17) {
      // XY plane selection
      // TODO: support other axis specification
    } else if (cType == "G" && cNum == 20) {
      // programming in inches
      if (!isInches) {
        scale *= 25.4;
      }
      isInches = true;
    } else if (cType == "G" && cNum == 21) {
      // programming in mm
      if (isInches) {
        scale /= 25.4;
      }
      isInches = false;
    } else if (cType == "G" && cNum == 28) {
      // return to home
      if (params["X"] !== undefined) {
        pos["X"] = 0;
      }
      if (params["Y"] !== undefined) {
        pos["Y"] = 0;
      }
      if (params["Z"] !== undefined) {
        pos["Z"] = 0;
      }
    } else if (cType == "G" && cNum == 40) {
      // tool radius compensation off.
      // TODO: implement tool radius compensation.
    } else if (cType == "G" && cNum == 90) {
      // absolute coordinates.
      isRelative = false;
    } else if (cType == "G" && cNum == 91) {
      // relative coordinates.
      isRelative = true;
    } else if (cType == "G" && cNum == 92) {
      // coordinate system offset. This command effectively states that the machine
      // is at the specified coordinates.

      // Fake support for this by validating that the command does not mess
      // with an axis we care about.
      // TODO: implement real support for this.
      if (params["X"] != undefined ||
          params["Y"] != undefined ||
          params["Z"] != undefined) {
        msg = "coordinate system offset (G92) not implemented.";
        warnings[msg] = (warnings[msg] || 0) + 1;
      }
    } else if (cType == "M") {
      // Most M codes can safely be ignored.

      switch(cNum) {
      case 0: // compulsory stop
      case 1: // optional stop
      case 2: // end of program
      case 3: // spindle on clockwise
      case 4: // spindle on counterclockwise
      case 5: // spindle stop
      case 30: // end of program with return to top
      case 40: // reprap eject
      case 82: // reprap extruder absolute mode
      case 83: // reprap extruder relative mode
      case 84: // reprap stop idle hold
      case 104: // reprap set extruder temperature
      case 105: // reprap get extruder temperature
      case 106: // reprap fan on
      case 107: // reprap fan off
      case 108: // reprap set extruder speed
      case 109: // reprap set extruder temperature and wait
      case 140: // reprap set bed temperature (fast)
      case 141: // reprap set chamber temperature (fast)
      case 143: // reprap set maximum hot-end temperature
      case 190: // reprap wait for bed temperature to reach target
        continue;
      default:
        msg = "unimplemented gcode command: " + parts[0];
        warnings[msg] = (warnings[msg] || 0) + 1;
      }
    } else {
      msg = "unknown gcode command: " + parts[0];
      warnings[msg] = (warnings[msg] || 0) + 1;
    }
  }

  paper.view.draw();

  // Log all warnings.
  $("#warnings-render").html("");
  $("#warnings-render").hide();
  for (w in warnings) {
    console.log(w);
    $("<div>", {"text": w}).appendTo("#warnings-render");
  }
  if (Object.keys(warnings).length > 0) {
    $("#warnings-render").show();
  }
}

function loadSettingsFromStorage() {
  // Load any persisted settings into a global variable.
  chrome.storage.local.get("settings", function(o) {
    var s = {}
    if (o && o["settings"]) {
      s = o["settings"];
    }

    // Fill in any missing settings.
    s["workspace-width-mm"] = s["workspace-width-mm"] || window.settings["workspace-width-mm"];
    s["workspace-depth-mm"] = s["workspace-depth-mm"] || window.settings["workspace-depth-mm"];
    s["workspace-height-mm"] = s["workspace-height-mm"] || window.settings["workspace-height-mm"];
    s["workspace-port"] = s["workspace-port"] || window.settings["workspace-port"];
    s["workspace-baud"] = s["workspace-baud"] || window.settings["workspace-baud"];

    window.settings = s;

    configureSettingsPanel();
  });
}

function saveSettingsToStorage(settings) {
  chrome.storage.local.set({"settings": settings});
}

function updateSettingsPanel() {
    console.log("updating settings page");

    var s = window.settings;

    // Fill in any persisted settings.
    $("#input-workspace-width").val(s["workspace-width-mm"]);
    $("#input-workspace-depth").val(s["workspace-depth-mm"]);
    $("#input-workspace-height").val(s["workspace-height-mm"]);
    $("#input-workspace-baud").val(s["workspace-baud"]);

    // lookup the available serial devices.
    chrome.serial.getDevices(function(device) {
      $("#input-workspace-port").html("");
      for (var i = 0; i < device.length; i++) {
        var path = device[i].path;
        var opt = $("<option/>");
        opt.text(path);
        opt.val(path);
        if (s["workspace-port"] == path) {
          opt.prop("selected", 1);
        }
        $("#input-workspace-port").append(opt);
      }
    });
}

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

var incomingCommandLookbackChar = ' ';

/**
 * Log a command to the console display.
 *
 * @param {string} cmd The command that was sent or received
 * @param {bool} isSend True if the message was outgoing
 */
function logCommand(cmd, isSend) {
  c = $("#console-log");

  // For commands received, we want to look for an 'ok' to clear
  // our command block.
  if (!isSend) {
    // The lookback character is needed because the 2 byte 'ok' can be split.
    if ((incomingCommandLookbackChar + cmd).indexOf("ok") != -1) {
      window.workspacePendingAck = false;
    }
    if (cmd.length > 0) {
      incomingCommandLookbackChar = cmd.charAt(cmd.length - 1);
    }
  }

  // Determine the node to add the incoming text to. Since incoming text
  // can be broken into multiple calls to this funciton, we want to join
  // blocks and only split when we detect interleving or a newline.
  var nodeToWriteTo;
  var lastChild = c.children().last();
  if (!isSend && lastChild && lastChild.hasClass("log-remote-entry")) {
    // incoming data may be split, so grab the last element instead of a new one.
    nodeToWriteTo = lastChild;
  } else {
    nodeToWriteTo = $("<div/>", {
      "class": isSend ? "log-user-entry" : "log-remote-entry"
    });
    nodeToWriteTo.appendTo(c);
  }

  // Add each line to the console output.
  lines = cmd.split("\n");
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    line = line.replace("\r", "");
    nodeToWriteTo.text(nodeToWriteTo.text() + makeHumanReadable(line));

    // Tag nodes which are just an ack.
    if (!isSend) {
      if (nodeToWriteTo.text() == "ok") {
        nodeToWriteTo.addClass("is-ack");
      } else {
        nodeToWriteTo.removeClass("is-ack");
      }
    }

    if (i < lines.length - 1) {
      nodeToWriteTo = $("<div/>", {
        "class": isSend ? "log-user-entry" : "log-remote-entry"
      });
      nodeToWriteTo.appendTo(c);
    }
  }

  // Limit our history (it could be megs of data when processing a file).
  if (c.children().length > CONSOLE_MAX_SCROLLBACK) {
    c.children().slice(0, c.children().length - CONSOLE_MAX_SCROLLBACK).remove();
  }
  c.scrollTop(10000);
}

/**
 * Send a command to an active serial connection.
 */
function sendCommandToSerialConnection(cmd) {
  if (cmd.indexOf("G90") != -1) {
    window.workspaceIsRelativeMode = false;
  } else if (cmd.indexOf("G91") != -1) {
    window.workspaceIsRelativeMode = true;
  } else if (cmd.indexOf("G20") != -1) {
    window.workspaceIsMm = false;
  } else if (cmd.indexOf("G21") != -1) {
    window.workspaceIsMm = true;
  }

  // make sure we have a device available.
  if (!window.workspaceConnectionId) {
    showWarning("cmd", "no device connection available.");
    return;
  }

  // Actually send the command.
  chrome.serial.send(window.workspaceConnectionId,
      str2ab(cmd + "\n"), function(info) {
    if (info.error) {
      showWarning("cmd", "failed to send command: " + info.error);
    }    
  });

  logCommand(cmd, true);
}

/**
 * Enqueue a list of commands to send to the workspace.
 */
function enqueueCommandsToSend(commands) {
  window.workspaceCommandQueue = window.workspaceCommandQueue.concat(commands);
  $("#lbl-enqueued-command-count").text(window.workspaceCommandQueue.length);

  // disable manual input since the user would likely mess up the program.
  if (window.workspaceCommandQueue.length > 5) {
    $(".connection-enabled").prop("disabled", 1);
  }
}

/**
 * Process one element of the command queue.
 */
function processCommandQueue() {
  // Only process the queue if we are connected.
  if (window.workspaceCommandQueue.length == 0 || !window.workspaceConnectionId) {
    return;
  }

  // Don't process anymore commands until we have received an 'ok' from the workspace.
  if (window.workspacePendingAck) {
    return;
  }

  // Pop the first element off the queue and send it to the serial line.
  window.workspacePendingAck = true;
  sendCommandToSerialConnection(workspaceCommandQueue.shift());
  $("#lbl-enqueued-command-count").text(window.workspaceCommandQueue.length);

  // re-enable manual input.
  if (window.workspaceCommandQueue.length == 0 && window.workspaceConnectionId) {
    $(".connection-enabled").prop("disabled", 0);
  }
}

/**
 * Perform an emergency machine stop. This will send a M112 command, clear the
 * command queue, and disconnect from the machine.
 * 
 * Per documentation, the machine will likely need to be manually reset on
 * the controller board before it can be used again.
 */
function emergencyStop() {
  console.error("!!!emergency stop activated!!!");

  // Clear the command queue.
  window.workspaceCommandQueue = [];

  // Send the command to perform an emergency stop.
  sendCommandToSerialConnection("M112", true);

  // Send an ascii cancel command.
  sendCommandToSerialConnection("\x18", true);

  // Update the UI.
  $("#lbl-enqueued-command-count").text(window.workspaceCommandQueue.length);
}

/**
 * Convert an ArrayBuffer to a string.
 */
var ab2str=function(buf) {
  return String.fromCharCode.apply(null, new Uint8Array(buf));
};

/**
 * Convert a string to an ArrayBuffer.
 */
var str2ab=function(str) {
  var buf=new ArrayBuffer(str.length);
  var bufView=new Uint8Array(buf);
  for (var i=0; i<str.length; i++) {
    bufView[i]=str.charCodeAt(i);
  }
  return buf;
}

function getStepSize() {
  return Math.pow(10, parseInt($("#input-stepsize").val()));
}

/**
 * Enqueue a command to perform a relative move. The global step size
 * will be used.
 *
 * @param {string} axis The axis to move about (eg. 'X-')
 */
function enqueueRelativeMove(axis) {
  var commands = [];
  if (!window.workspaceIsRelativeMode) {
    commands.push("G91");
  }
  if (!window.workspaceIsMm) {
    commands.push("G21");
  }
  commands.push("G1 " + axis + getStepSize());
  enqueueCommandsToSend(commands);
}

/**
 * Connect to the configured serial port.
 */
function connectToSerialPort() {
  window.workspaceIsRelativeMode = false;
  window.workspaceIsMm = false;

  // Clear any current warnings.
  clearWarningGroup("connection");

  // If there is no connection port, send the user to the settings path.
  if (!window.settings["workspace-port"]) {
    $('#main-tabs a[href="#view-settings"]').tab('show');
    return;
  }

  // fast user feedback that something happened.
  $("#btn-connect").prop("disabled", 1);

  var options = {
    "bitrate": window.settings["workspace-baud"],
    "ctsFlowControl":false,
    "dataBits":"eight",
    "parityBit":"no",
    "stopBits":"one"
  };
  console.log("connecting to '" + window.settings["workspace-port"] +
       "' with options: " + JSON.stringify(options));
  chrome.serial.connect(window.settings["workspace-port"], options, function(info) {
    if (info == null) {
      showWarning("connection", "Unable to connect to " + window.settings["workspace-port"]);
      $("#btn-connect").prop("disabled", 0);
      $("#btn-connect").show();
      return;
    }

    console.log("serial connection obtained:\n" + JSON.stringify(info));

    for (k in options) {
      if (options[k] != info[k]) {
        showWarning("connection", "Chrome did not use requested serial connection option. [" +
            k + "; expected:" + options[k] + ", actual:" + info[k] + "]");
      }
    }

    window.workspaceConnectionId = info.connectionId;

    $("#btn-connect").prop("disabled", 0);

    $("#btn-connect").hide();
    $("#btn-disconnect").show();
    $(".connection-enabled").prop("disabled", 0);

    // Don't fall asleep while controlling a machine.
    chrome.power.requestKeepAwake("system");
  });
}

function configureNavBar() {
  $("#btn-connect").show();
  $("#btn-connect").click(connectToSerialPort);

  $("#btn-disconnect").hide();
  $("#btn-disconnect").click(function(e) {
    // If we're disconnected, we don't need to keep the system awake.
    chrome.power.releaseKeepAwake();

    // fast user feedback that something happened.
    if (window.workspaceConnectionId) {
      $("#btn-disconnect").prop("disabled", 1);
      console.log("disconnecting connection " + window.workspaceConnectionId);
      chrome.serial.disconnect(window.workspaceConnectionId, function(result) {
        window.workspaceConnectionId = null;

        $("#btn-disconnect").prop("disabled", 0);
        $("#btn-connect").show();
        $("#btn-disconnect").hide();
        $(".connection-enabled").prop("disabled", 1);
      });
    }
  });
}

function configureControlPanel() {
  // Configure the most important button first!
  $("#btn-emergency-stop").click(function(e) {
    emergencyStop();
  });

  // When we start, we assume no connections are active.
  $(".connection-enabled").prop("disabled", 1);

  // prevent the form from actually submitting.
  $("#form-command-console").submit(function() {return false;});
  $("#form-command-jog").submit(function() {return false;});

  // configure the send button.
  $("#btn-control-send-cmd").click(function(e) {
    var c = $("#input-control-cmd").val();
    window.manualInputHistory.push(c);
    window.manualInputPosition = window.manualInputHistory.length;
    enqueueCommandsToSend([c]);
    $("#input-control-cmd").val("");
  });

  // Configure the console panel to display incoming messages.
  chrome.serial.onReceive.addListener(function(info) {
    logCommand(ab2str(info.data), false);
  });

  // Log errors
  chrome.serial.onReceiveError.addListener(function(info) {
    showWarning("connection", "error with serial communication: " + info.error);
  });

  // configure the jog controls.
  $("#input-stepsize").change(function(e) {
    $("#output-stepsize").text(getStepSize());
  }).change();

  $("#btn-x-up").click(function(e) {
    enqueueRelativeMove("X");
  });
  $("#btn-x-down").click(function(e) {
    enqueueRelativeMove("X-");
  });
  $("#btn-x-home").click(function(e) {
    enqueueCommandsToSend(["G28 X0"]);
  });
  $("#btn-y-up").click(function(e) {
    enqueueRelativeMove("Y");
  });
  $("#btn-y-down").click(function(e) {
    enqueueRelativeMove("Y-");
  });
  $("#btn-y-home").click(function(e) {
    enqueueCommandsToSend(["G28 Y0"]);
  });
  $("#btn-z-up").click(function(e) {
    enqueueRelativeMove("Z");
  });
  $("#btn-z-down").click(function(e) {
    enqueueRelativeMove("Z-");
  });
  $("#btn-z-home").click(function(e) {
    enqueueCommandsToSend(["G28 Z0"]);
  });
  $("#btn-stepsize-up").click(function(e) {
    $("#input-stepsize").val(parseInt($("#input-stepsize").val()) + 1).change();
  });
  $("#btn-stepsize-down").click(function(e) {
    $("#input-stepsize").val(parseInt($("#input-stepsize").val()) - 1).change();
  });

  // configure the console actions.
  $("#lnk-clear-log").click(function(e) {
    $("#console-log").html("");
  });
}

function configureFilePanel() {
  // Initialize paper.js
  paper.setup($("#render-canvas")[0]);

  // update the load-file panel whenever it is shown.
  $('a[href="#view-load-file"]').on('shown.bs.tab', function (e) {
    console.log("updating file preview area.");
    renderGcode(window.commandSequence);
  });

  $("#btn-send-file-to-machine").click(function(e) {
    console.log("enqueing file command sequence.")
    enqueueCommandsToSend(window.commandSequence);

    // Disable the button so we don't send it again.
    $('#main-tabs a[href="#view-control-panel"]').tab('show');
  });

  // Setup the action for selecting a local file.
  $("#input-file-local").change(handleFileSelect);
  $("#btn-open-local-file").click(function(e) {
    $("#input-file-local").click();
  });

  // Setup the drag-and-drop listeners.
  var dropZone = $("body")[0];
  dropZone.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();

    $('#main-tabs a[href="#view-load-file"]').tab('show');
  }, false);
  dropZone.addEventListener('drop', handleFileSelect, false);

  // re-render whenever the panel is resized
  // TODO: can the canvas just be redrawn with the same lines?
  $(window).resize(function() {
    clearTimeout($.data(this, 'resizeTimer'));
    $.data(this, 'resizeTimer', setTimeout(function() {
      if ($("#render-canvas").is(":visible")) {
        renderGcode(window.commandSequence);      
      }
    }, 500));
  });
}

function configureSettingsPanel() {
  // update the settings panel whenever it is shown.
  $('a[href="#view-settings"]').on('shown.bs.tab', updateSettingsPanel);

  // save settings
  $("#btn-update-settings").click(function(e) {
    console.log("settings saved");
    var settings = window.settings;
    settings["workspace-width-mm"] = $("#input-workspace-width").val();
    settings["workspace-depth-mm"] = $("#input-workspace-depth").val();
    settings["workspace-height-mm"] = $("#input-workspace-height").val();
    settings["workspace-port"] = $("#input-workspace-port").val();
    settings["workspace-baud"] = parseInt($("#input-workspace-baud").val());
    window.settings = settings;
    saveSettingsToStorage(settings);

    // give some visual feedback to the user.
    $("#btn-update-settings").text("done.").prop("disabled", 1);
    setTimeout(function() {
      $("#btn-update-settings").text("update").prop("disabled", 0);
    }, 1000);
  });
}

function configureKeyboard() {
  $("#input-control-cmd").keydown(function(e) {
    e.stopPropagation();

    if (e.keyCode == 27) { // escape; blur the manual command input.
      // the delay is to allow the current event propagation to finish.
      setTimeout(function() {
        $("#input-control-cmd").blur();
      }, 1);

    } else if (e.keyCode == 38) { // up arrow; show previous history position.
      window.manualInputPosition = Math.max(window.manualInputPosition - 1, 0);
      var c = ((window.manualInputPosition < window.manualInputHistory.length) ?
          window.manualInputHistory[window.manualInputPosition] : "");
      $("#input-control-cmd").val(c);
      setTimeout(function() {
        $("#input-control-cmd")[0].setSelectionRange(c.length, c.length);
      }, 0);
    } else if (e.keyCode == 40) { // down arrow; show next history position.
      window.manualInputPosition = Math.min(window.manualInputPosition + 1, window.manualInputHistory.length);
      var c = ((window.manualInputPosition < window.manualInputHistory.length) ?
          window.manualInputHistory[window.manualInputPosition] : "");
      $("#input-control-cmd").val(c);
      setTimeout(function() {
        $("#input-control-cmd")[0].setSelectionRange(c.length, c.length);
      }, 0);
    }
  });

  $(document).keydown(function(e){
    e.stopPropagation();

    // Control panel hotkeys.
    if ($("#view-control-panel").is(":visible")) {
      var stepSize = getStepSize();

      if (window.workspaceCommandQueue.length > 0) {
        // Ignore movement commands when there is an active command queue.
        return;

      // Arrow key XY movement
      } else if (e.keyCode == 37) { // left arrow; step X axis down
        $("#btn-x-down").click();
      } else if (e.keyCode == 39) { // right arrow; step X axis up
        $("#btn-x-up").click();
      } else if (e.keyCode == 38) { // up arrow; step Y axis up
        $("#btn-y-up").click();
      } else if (e.keyCode == 40) { // down arrow; step Y axis down
        $("#btn-y-down").click();

      // Keyboard XYZ movement
      } else if (e.keyCode == 76) { // 'l'; step X axis up
        $("#btn-x-up").click();
      } else if (e.keyCode == 74) { // 'j'; step X axis down
        $("#btn-x-down").click();
      } else if (e.keyCode == 73) { // 'i'; step Y axis up
        $("#btn-y-up").click();
      } else if (e.keyCode == 75) { // 'k'; step Y axis down
        $("#btn-y-down").click();
      } else if (e.keyCode == 65) { // 'a'; step Z axis up
        $("#btn-z-up").click();
      } else if (e.keyCode == 90) { // 'z'; step Z axis down
        $("#btn-z-down").click();

      // Stepsize incrementing.
      } else if (e.keyCode == 187) { // '='; increment step size
        $("#btn-stepsize-up").click();
      } else if (e.keyCode == 189) { // '-'; decrement step size
        $("#btn-stepsize-down").click();

      // Other.
      } else if (e.keyCode == 191) { // '/'; focus the manual command input.
        // the delay is to allow the current event propagation to finish.
        setTimeout(function() {
          $("#input-control-cmd").focus();
        }, 1);
      }
    }
  });
}


$(document).ready(function() {
  loadSettingsFromStorage();

  configureNavBar();
  configureControlPanel();
  configureFilePanel();
  configureSettingsPanel();
  configureKeyboard();

  // Process an element from the command queue every few ms.
  setInterval(processCommandQueue, 100);
});
