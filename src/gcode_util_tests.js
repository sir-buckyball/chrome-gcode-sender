QUnit.module("fileservice: extractCommandSequence");

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
