/**
 * A service for loading gcode files.
 */
app.service('fileService', function($rootScope) {
  // The 'API' for this service.
  var api = {
    commandSequence: []
  };

  var processFile = function(f) {
    api.fileName = f.name;
    api.fileLastModified = moment(f.lastModifiedDate).fromNow();

    // TODO: don't read binary files.

    console.log('processing file: ' + f.name);
    console.time('readFile');
    var reader = new FileReader();
    reader.onloadend = function(evt) {
      if (evt.target.readyState == FileReader.DONE) {
        console.timeEnd('readFile');
        api.commandSequence = extractCommandSequence(evt.target.result);
        $rootScope.$broadcast('fileUpdated');
      }
    };
    reader.readAsText(f);
  };

  api.openFile = function() {
    chrome.fileSystem.chooseEntry({
      'type': 'openFile',
      'accepts': [{
        'description': 'gcode files',
        'extensions': ['gcode', 'nc']
      }]
    }, function(entry) {
      entry.file(function(file) {
        $rootScope.$apply(function() {
          processFile(file);
        });
      });
    });
  };

  // This method is for handling drag-and-drop files.
  api.handleFileSelect = function(evt) {
    evt.stopPropagation();
    evt.preventDefault();

    var files;
    if (evt.target.files) {
      files = evt.target.files; // FileList object
    } else if (evt.dataTransfer) {
      files = evt.dataTransfer.files; // FileList object.
    } else {
      console.log('unknown file input');
    }

    // only examine the first file.
    if (files.length > 0) {
      $rootScope.$apply(function() {
        processFile(files[0]);
      });
    } else {
      console.log('input file had no content.');
    }
  }

  return api;
});

/* Break a string of gcode text into a sequence of commands. */
var extractCommandSequence = function(text) {
  // Break the raw text into a command sequence.
  var commandSequence = [];
  var currentCommand = [];
  var inSemicolonComment = false;
  var inParenComment = false;
  for (var i = 0; i < text.length; i++) {
    // Deal with comments in the file.
    var c = text[i];
    if (inSemicolonComment) {
      if (c == '\n') {
        inSemicolonComment = false;
      }
      continue;
    } else if (c == ';') {
      inSemicolonComment = true;
      continue;
    }

    if (inParenComment) {
      if (c == ')') {
        inParenComment = false;
      }
      continue;
    } else if (c == '(') {
      inParenComment = true;
      continue;
    }

    // Check for the start of a new command.
    if (c == 'G' || c == 'M') {
      currentCommand = currentCommand.join('').trim().toUpperCase();
      if (currentCommand.length > 0) {
        commandSequence.push(currentCommand);
      }
      currentCommand = [];
    }

    // Skip existing newlines.
    if (c == '\n' || c == '\t') {
      c = ' ';
    }

    // Copy each character over.
    currentCommand.push(c);
  }

  // Don't forget about the very last command.
  currentCommand = currentCommand.join('').trim().toUpperCase();
  if (currentCommand.length > 0) {
    commandSequence.push(currentCommand);
  }
  return commandSequence;
};
