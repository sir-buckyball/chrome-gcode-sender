// author: Buck Clay (dev@buckclay.com)
// date: 2014-03-22

/**
 * Tease apart a gcode command into its component parts.
 *
 * @param {string} cmd - a gcode command string
 * @return {string[]} A list of command parts
 */
function breakupGcodeCommand(cmd) {
  var parts = [];
  var curPart = [];
  var inPart = false;

  for (var i = 0; i < cmd.length; i++) {
    var c = cmd[i];
    if (c == " " || c == "\t") {
      continue;
    }
    if (inPart) {
      if ((c >= "0" && c <= "9") || c == "." || c == "-") {
        curPart.push(c);
      } else {
        parts.push(curPart.join(""));
        inPart = false;
      }
    }
    if (!inPart) {
      curPart = [c];
      inPart = true;
    }
  }

  if (curPart.length > 0) {
    parts.push(curPart.join(""));
  }

  return parts;
}

/**
 * Analyze the given gcode to determine the following properties:
 *  - bounding region {min,max}{X,Y,Z}
 *  - estimated execution time
 *  - warnings
 *
 * @param {string[]} gcode - A list of gcode commands
 */
function analyzeGcode(gcode) {
  console.time("analyzeGcode");
  var warnings = {};

  // A toggle for absolute v. relative coordinate specification.
  var isRelative = false;

  // A toggle for inch v. millimeter coordinate specification.
  var isInches = false;

  // Do all distances in millimeters.
  var scale = 1;

  var pos = {"X": 0, "Y": 0, "Z": 0};
  var minPos = {"X": 0, "Y": 0, "Z": 0};
  var maxPos = {"X": 0, "Y": 0, "Z": 0};

  // The feedrate in mm per minute.
  // NOTE: A high default feedrate will calculate movements times to be near instant.
  // NOTE: feedrate is a maximum, machines will perform acceleration
  // management which will affect actual time.
  var feedrate = 1000000000;
  var estimatedExecutionTimeMin = 0;

  for (var i = 0; i < gcode.length; i++) {
    var prevPos = {"X": pos.X, "Y": pos.Y, "Z": pos.Z};
    var command = gcode[i];
    var parts = breakupGcodeCommand(command);

    var cType = parts[0][0];
    var cNum = parseInt(parts[0].substr(1), 10);

    // Read the command parameters.
    var params = {};
    for (var j = 1; j < parts.length; j++) {
      params[parts[j][0].toUpperCase()] = parseFloat(parts[j].substr(1)) || 0;
    }

    if (cType == "G" && (cNum === 0 || cNum === 1)) {
      pos.X = ((isRelative || params.X === undefined) ? pos.X : 0) +
          ((params.X === undefined) ? 0 : params.X * scale);
      pos.Y = ((isRelative || params.Y === undefined) ? pos.Y : 0) +
          ((params.Y === undefined) ? 0 : params.Y * scale);
      pos.Z = ((isRelative || params.Z === undefined) ? pos.Z : 0) +
          ((params.Z === undefined) ? 0 : params.Z * scale);
      if (params.F !== undefined) {
        feedrate = params.F * scale;
      }

      var dist = Math.sqrt(
          Math.pow(pos.X - prevPos.X, 2) +
          Math.pow(pos.Y - prevPos.Y, 2) +
          Math.pow(pos.Z - prevPos.Z, 2));
      estimatedExecutionTimeMin += dist / feedrate;

    } else if (cType == "G" && (cNum == 2 || cNum == 3)) {
      // TODO: Deal with arcs not being aligned to the axis
      //   (and thus exceeding the bounding region of their start/end points)
      pos.X = ((isRelative || params.X === undefined) ? pos.X : 0) +
          ((params.X === undefined) ? 0 : params.X * scale);
      pos.Y = ((isRelative || params.Y === undefined) ? pos.Y : 0) +
          ((params.Y === undefined) ? 0 : params.Y * scale);
      pos.Z = ((isRelative || params.Z === undefined) ? pos.Z : 0) +
          ((params.Z === undefined) ? 0 : params.Z * scale);
      if (params.F !== undefined) {
        feedrate = params.F * scale;
      }

      // TODO: Actually calculate the length of the arc. We'll assume this is
      // the longest recommend arc length. Assuming no more than a 120 degree
      // span, the length is 2*pi*sqrt(3)/9 ~= 1.209 times the direct distance.
      var dArc = 1.209 * Math.sqrt(
          Math.pow(pos.X - prevPos.X, 2) +
          Math.pow(pos.Y - prevPos.Y, 2) +
          Math.pow(pos.Z - prevPos.Z, 2));
      estimatedExecutionTimeMin += dArc / feedrate;

    } else if (cType == "G" && cNum == 4) {
      // dwell
      estimatedExecutionTimeMin += (params.U === undefined) ? 0 : params.U / 60.0;
      estimatedExecutionTimeMin += (params.P === undefined) ? 0 : params.P / 60000.0;
    } else if (cType == "G" && cNum == 17) {
      // XY plane selection
    } else if (cType == "G" && cNum == 20) {
      // programming in inches
      if (!isInches) {
        scale = 25.4;
      }
      isInches = true;
    } else if (cType == "G" && cNum == 21) {
      // programming in mm
      if (isInches) {
        scale = 1;
      }
      isInches = false;
    } else if (cType == "G" && cNum == 28) {
      // return to home
      if (params.X !== undefined) {
        pos.X = 0;
      }
      if (params.Y !== undefined) {
        pos.Y = 0;
      }
      if (params.Z !== undefined) {
        pos.Z = 0;
      }
    } else if (cType == "G" && cNum == 40) {
      // tool radius compensation off.
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
      if (params.X !== undefined ||
          params.Y !== undefined ||
          params.Z !== undefined) {
        msg = "coordinate system offset (G92) not implemented.";
        warnings[msg] = (warnings[msg] || 0) + 1;
      }
    } else if (cType == "M") {
      // M codes can safely be ignored.
      continue;
    } else {
      msg = "unknown gcode command: " + parts[0];
      warnings[msg] = (warnings[msg] || 0) + 1;
    }

    // Update our bounding regions.
    // TODO: Arcs can cause us to exceed these regions!
    if (minPos.X > pos.X) {minPos.X = pos.X;}
    if (minPos.Y > pos.Y) {minPos.Y = pos.Y;}
    if (minPos.Z > pos.Z) {minPos.Z = pos.Z;}
    if (maxPos.X < pos.X) {maxPos.X = pos.X;}
    if (maxPos.Y < pos.Y) {maxPos.Y = pos.Y;}
    if (maxPos.Z < pos.Z) {maxPos.Z = pos.Z;}
  }

  console.timeEnd("analyzeGcode");
  return {
    "warnings": warnings,
    "maxPos": maxPos,
    "minPos": minPos,
    "estimatedExecutionTimeMin": estimatedExecutionTimeMin
  };
}
