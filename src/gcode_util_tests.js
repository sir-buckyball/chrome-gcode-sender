QUnit.module("gcode_util: extractCommandSequence");

QUnit.test("newline delimited", function() {
  var expected = [
    "G90\n",
    "G1 Z0.25 F20\n",
    "G0 X1.125 Y1.125 F10\n",
    "G1 Z-0.1 F5\n",
  ];
  var input = "G90\nG1 Z0.25 F20\nG0 X1.125 Y1.125 F10\nG1 Z-0.1 F5";
  QUnit.deepEqual(extractCommandSequence(input), expected);
});

QUnit.test("one long line", function() {
  var expected = [
    "G90\n",
    "G1 Z0.25 F20\n",
    "G0 X1.125 Y1.125 F10\n",
    "G1 Z-0.1 F5\n",
  ];
  var input = "G90 G1 Z0.25 F20 G0 X1.125 Y1.125 F10 G1 Z-0.1 F5";
  QUnit.deepEqual(extractCommandSequence(input), expected);
});

QUnit.test("carriage returns", function() {
  var expected = [
    "G90\n",
    "G1 Z0.25 F20\r",
    "X1.125 Y1.125 F10\r",
    "Z-0.1 F5\n",
  ];
  var input = "G90 G1 Z0.25 F20\rX1.125 Y1.125 F10\rZ-0.1 F5";
  var actual = extractCommandSequence(input);
  QUnit.equal(JSON.stringify(actual), JSON.stringify(expected));
});

QUnit.test("CRLF", function() {
  var expected = [
    "G90\n",
    "G1 X10 F20\n",
    "G0 Y20 Z5\n",
  ];
  var input = "G90\r\nG1 X10 F20\r\n\r\nG0 Y20 Z5\r\n";
  var actual = extractCommandSequence(input);
  QUnit.equal(JSON.stringify(actual), JSON.stringify(expected));
});

QUnit.module("gcode_util: analyzeGcode");

QUnit.test("empty", function() {
  var expected = {
    "estimatedExecutionTimeMin": 0,
    "maxPos": {"X": 0, "Y": 0, "Z": 0},
    "minPos": {"X": 0, "Y": 0, "Z": 0},
    "warnings": {}
  }
  var input = [
    "G21\n",
    "G90\n",
  ];
  QUnit.deepEqual(analyzeGcode(input), expected);
});

QUnit.test("base", function() {
  var expected = {
    "estimatedExecutionTimeMin": 15,
    "maxPos": {
      "X": 100,
      "Y": 100,
      "Z": 0
    },
    "minPos": {
      "X": 0,
      "Y": 0,
      "Z": 0
    },
    "warnings": {}
  }
  var input = [
    "G21\n",
    "G90\n",
    "G0 X100 F10\n",
    "G1 Y100 F20\n",
  ];
  QUnit.deepEqual(analyzeGcode(input), expected);
});


QUnit.test("carriage returns", function() {
  var expected = {
    "estimatedExecutionTimeMin": 15,
    "maxPos": {
      "X": 100,
      "Y": 100,
      "Z": 0
    },
    "minPos": {
      "X": 0,
      "Y": 0,
      "Z": 0
    },
    "warnings": {}
  }
  var input = [
    "G21\n",
    "G90\n",
    "G0 X100 F10\r",
    "Y100 F20\n",
  ];
  QUnit.deepEqual(analyzeGcode(input), expected);
});
