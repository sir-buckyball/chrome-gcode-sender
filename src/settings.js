app.controller('settingsCtrl', function($scope, settingsService) {
  $scope.settings = settingsService.settings;
  $scope.loadSettings = settingsService.load;
  $scope.saveSettings = settingsService.save;
  $scope.deviceHolder = {};

  chrome.serial.getDevices(function(devices) {
    var d = [];
    for (var i = 0; i < devices.length; i++) {
      d.push(devices[i].path);
    }
    $scope.deviceHolder.devices = d;
    console.log(devices.length + " serial device(s) detected:\n" + JSON.stringify(devices));
    $scope.$apply();
  });
});

app.service('settingsService', function($rootScope) {
  var settings = {
    workspace_width_mm: 150,
    workspace_depth_mm: 150,
    workspace_height_mm: 50,
    workspace_port: "",
    workspace_baud: 9600,
    workspace_show_estop: true,
    workspace_show_home: false,
    workspace_show_spindle: false,
    workspace_show_zero: false,
    workspace_jog_feedrate: 0,
    workspace_jog_rapid: false,
    gcode_preamble: "",
    gcode_postamble: ""
  };

  // Load any persisted settings into a global variable.
  // NOTE: For historical reasons, the settings are stored
  // with dashes instead of underscores.
  var loadSettings = function() {
    console.log("loading settings from storage.");
    chrome.storage.local.get("settings", function(o) {
      var s = {};
      if (o && o.settings) {
        s = o.settings;
      }

      if (s["workspace-width-mm"] !== undefined) {
        settings.workspace_width_mm = Number(s["workspace-width-mm"]);
      }
      if (s["workspace-depth-mm"] !== undefined) {
        settings.workspace_depth_mm = Number(s["workspace-depth-mm"]);
      }
      if (s["workspace-height-mm"] !== undefined) {
        settings.workspace_height_mm = Number(s["workspace-height-mm"]);
      }
      if (s["workspace-port"] !== undefined) {
        settings.workspace_port = s["workspace-port"];
      }
      if (s["workspace-baud"] !== undefined) {
        settings.workspace_baud = Number(s["workspace-baud"]);
      }
      if (s["workspace-show-estop"] !== undefined) {
        settings.workspace_show_estop = s["workspace-show-estop"];
      }
      if (s["workspace-show-home"] !== undefined) {
        settings.workspace_show_home = s["workspace-show-home"];
      }
      if (s["workspace-show-spindle"] !== undefined) {
        settings.workspace_show_spindle = s["workspace-show-spindle"];
      }
      if (s["workspace-show-zero"] !== undefined) {
        settings.workspace_show_zero = s["workspace-show-zero"];
      }
      if (s["workspace-jog-feedrate"] !== undefined) {
        settings.workspace_jog_feedrate = Number(s["workspace-jog-feedrate"]);
      }
      if (s["workspace-jog-rapid"] !== undefined) {
        settings.workspace_jog_rapid = s["workspace-jog-rapid"];
      }
      if (s["gcode-preamble"] !== undefined) {
        settings.gcode_preamble = s["gcode-preamble"];
      }
      if (s["gcode-postamble"] !== undefined) {
        settings.gcode_postamble = s["gcode-postamble"];
      }
      console.log("settings loaded from storage.\n" + JSON.stringify(settings));
      $rootScope.$apply();
    });
  };

  // Save settings to storage.
  var saveSettings = function() {
    // Keep writing settings the old way...
    var s = {};
    s["workspace-width-mm"] = settings.workspace_width_mm;
    s["workspace-depth-mm"] = settings.workspace_depth_mm;
    s["workspace-height-mm"] = settings.workspace_height_mm;
    s["workspace-port"] = settings.workspace_port;
    s["workspace-baud"] = settings.workspace_baud;
    s["workspace-show-estop"] = settings.workspace_show_estop;
    s["workspace-show-home"] = settings.workspace_show_home;
    s["workspace-show-spindle"] = settings.workspace_show_spindle;
    s["workspace-show-zero"] = settings.workspace_show_zero;
    s["workspace-jog-feedrate"] = settings.workspace_jog_feedrate;
    s["workspace-jog-rapid"] = settings.workspace_jog_rapid;
    s["gcode-preamble"] = settings.gcode_preamble;
    s["gcode-postamble"] = settings.gcode_postamble;
    chrome.storage.local.set({"settings": s});
    console.log("settings saved.\n" + JSON.stringify(s));
  };

  // Return our "API".
  return {
    settings: settings,
    load: loadSettings,
    save: saveSettings
  };
});
