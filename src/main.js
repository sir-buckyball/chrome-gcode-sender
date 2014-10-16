// author: Buck Clay (dev@buckclay.com)
// date: 2013-12-25

// TODO: something is causing it to be terribly slow...
// TODO: come back to load file, previous file is gone... (state loss)


/**
 * Clear the command queue.
 */
function clearCommandQueue() {
  window.workspaceCommandQueue = [];
  window.workspacePendingAck = false;
  $("#lbl-enqueued-command-count").text(0);
}


$(document).ready(function() {
  // configure the console actions.
  $("#lnk-clear-log").click(function(e) {
    $("#console-log").html("");
  });
  $("#lnk-clear-command-queue").click(clearCommandQueue);
  $("#lnk-clear-ack-block").click(function(e) {
    window.workspacePendingAck = false;
  });
});


// Configure AngularJS.
var app = angular.module('gcodeSender', ['ui.router', 'luegg.directives', 'cfp.hotkeys']);

app.config(function($stateProvider, $urlRouterProvider) {
  $stateProvider
    .state('about', {url: "/about", templateUrl: "about.html"})
    .state('settings', {
      url: "/settings",
      templateUrl: "settings.html",
      controller: "settingsCtrl"})
    .state('loadfile', {
      url: "/loadfile",
      templateUrl: "loadfile.html",
      controller: "loadFileCtrl"})
    .state('controlpanel', {
      url: "/controlpanel",
      templateUrl: "controlpanel.html",
      controller: "controlPanelCtrl"})
    ;
});

app.controller('mainCtrl', function($scope, $state, $window, hotkeys,
    settingsService, machineService, warningService, fileService) {
  settingsService.load();
  $state.go("controlpanel");

  $scope.$state = $state;
  $scope.warningService = warningService;
  $scope.machineService = machineService;

  /**
   * Connect to the configured serial port.
   */
  $scope.connect = function() {
    // If there is no connection port, send the user to the settings path.
    if (!settingsService.settings.workspace_port) {
      $state.go("settings");
      return;
    }

    machineService.connect(settingsService.settings.workspace_port,
        settingsService.settings.workspace_baud);
  };
  $scope.disconnect = machineService.disconnect;

  // Setup the drag-and-drop listeners.
  document.body.addEventListener('dragover', function(e) {
    e.stopPropagation();
    e.preventDefault();
    $state.go("loadfile");
  }, false);

  // Setup resize events.
  $window.addEventListener('resize', function() {
    $scope.$broadcast('resize');
  });

  // Global keyboard commands.
  hotkeys.add({
    combo: 'mod+o',
    description: 'open file',
    callback: function() {
      $state.go("loadfile");
      fileService.openFile();
    }
  });
  hotkeys.add({
    combo: 'mod+1',
    description: 'show control panel',
    callback: function() {$state.go('controlpanel');}
  });
  hotkeys.add({
    combo: 'mod+2',
    description: 'show load file',
    callback: function() {$state.go('loadfile');}
  });
  hotkeys.add({
    combo: 'mod+3',
    description: 'show settings',
    callback: function() {$state.go('settings');}
  });
  hotkeys.add({
    combo: 'mod+4',
    description: 'show about',
    callback: function() {$state.go('about');}
  });
});
