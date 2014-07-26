// TODO: handle clear log menu
// TODO: handle clear queue menu
// TODO: handle clear ack menu

/**
 * The controller for the control panel.
 */
app.controller('controlPanelCtrl', function($scope, hotkeys, settingsService, machineService) {
  $scope.emergencyStop = machineService.emergencyStop;
  $scope.settings = settingsService.settings;
  $scope.machineService = machineService;

  $scope.stepSize = 1;

  hotkeys.bindTo($scope)
    .add({
      combo: ['up', 'i'],
      description: 'move the Y axis in the + direction',
      callback: function() {$scope.relativeMove("Y")}
    })
    .add({
      combo: ['down' ,'k'],
      description: 'move the Y axis in the - direction',
      callback: function() {$scope.relativeMove("Y-")}
    })
    .add({
      combo: ['left', 'j'],
      description: 'move the X axis in the - direction',
      callback: function() {$scope.relativeMove("X-")}
    })
    .add({
      combo: ['right', 'l'],
      description: 'move the X axis in the + direction',
      callback: function() {$scope.relativeMove("X")}
    })
    .add({
      combo: ['a'],
      description: 'move the Z axis in the + direction',
      callback: function() {$scope.relativeMove("Z")}
    })
    .add({
      combo: ['z'],
      description: 'move the Z axis in the - direction',
      callback: function() {$scope.relativeMove("Z-")}
    })
    .add({
      combo: '-',
      description: 'decrement the step size',
      callback: function() {$scope.incrementStepSize(-1)}
    })
    .add({
      combo: '=',
      description: 'increment the step size',
      callback: function() {$scope.incrementStepSize(1)}
    })
    .add({
      combo: '/',
      description: 'focus the manual command entry',
      callback: function() {
        // Let the event finish propagating.
        setTimeout(function() {
          $("#input-control-cmd").focus();
        }, 1);
      }
    });

  // The manual input field has to be configured manually.
  // The history of manual commands that the user has entered.
  var manualInputHistory = [];
  var manualInputPosition = 0;

  $scope.manualCommand = "";
  $scope.sendManualCommand = function(command) {
    manualInputHistory.push(command);
    manualInputPosition = manualInputHistory.length;
    machineService.enqueueCommands([command]);
    $scope.manualCommand = "";
  }

  $("#input-control-cmd").keydown(function(e) {
    e.stopPropagation();

    if (e.keyCode == 27) { // escape; blur the manual command input.
      // the delay is to allow the current event propagation to finish.
      setTimeout(function() {
        $("#input-control-cmd").blur();
      }, 1);

    } else if (e.keyCode == 38) { // up arrow; show previous history position.
      manualInputPosition = Math.max(manualInputPosition - 1, 0);
      var prevCommand = ((manualInputPosition < manualInputHistory.length) ?
          manualInputHistory[manualInputPosition] : "");
      $scope.manualCommand = prevCommand;
      setTimeout(function() {
        $("#input-control-cmd")[0].setSelectionRange(prevCommand.length, prevCommand.length);
      }, 1);
    } else if (e.keyCode == 40) { // down arrow; show next history position.
      manualInputPosition = Math.min(manualInputPosition + 1, manualInputHistory.length);
      var nextCommand = ((manualInputPosition < manualInputHistory.length) ?
          manualInputHistory[manualInputPosition] : "");
      $scope.manualCommand = nextCommand;
      setTimeout(function() {
        $("#input-control-cmd")[0].setSelectionRange(nextCommand.length, nextCommand.length);
      }, 1);
    }
  });

  var shouldSendCommands = function() {
    return machineService.isConnected && machineService.commandQueue.length == 0;
  }

  $scope.getStepSize = function() {
    return Math.pow(10, $scope.stepSize);
  }

  $scope.incrementStepSize = function(amt) {
    $scope.stepSize = Math.max(-1, Math.min(2, $scope.stepSize + amt));
  }

  /**
   * Enqueue a command to perform a relative move. The global step size
   * will be used.
   *
   * @param {string} axis The axis to move about (eg. 'X-')
   */
  $scope.relativeMove = function(axis) {
    if (!shouldSendCommands()) {
      return;
    }

    var commands = [];
    if (!machineService.isRelativeMode) {
      commands.push("G91");
    }
    if (!machineService.isMm) {
      commands.push("G21");
    }

    var feedrate = settingsService.settings.workspace_jog_feedrate;
    var mv = "G1";
    if (settingsService.settings.workspace_jog_rapid) {
      mv = "G0"
    } else if (feedrate != NaN && feedrate > 0) {
      mv += " F" + feedrate;
    }
    mv += " " + axis + $scope.getStepSize();
    commands.push(mv);

    machineService.enqueueCommands(commands);
  };

  $scope.sendCommands = function(cmds) {
    if (!shouldSendCommands()) {
      return;
    }
    machineService.enqueueCommands(cmds);
  }
});
