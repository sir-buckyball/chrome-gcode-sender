/**
 * A service for rendering global warnings to the user.
 */
app.service('warningService', function($rootScope) {
  /**
   * Display a warning to the user. Messages are grouped so
   * they can be cleared when the condition no longer applies.
   *
   * @param {string} group The group the warning belongs to
   * @param {string} msg The message of the warning
   */
  var warn = function(group, msg) {
    console.warn(msg);
    api.warnings.push(msg);
  };

  /**
   * Clear all warnings.
   */
  var clear = function() {
    api.warnings = [];
  }

  // Return the "API" for this service.
  var api = {
    warnings:[],
    clear:clear,
    warn:warn
  };
  return api;
});
