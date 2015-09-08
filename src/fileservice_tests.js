QUnit.module("fileservice");

QUnit.test("extractCommandSequence", function() {
  var expected = [
    "G90",
    "G1 Z0.25 F20",
    "G0 X1.125 Y1.125 F10",
    "G1 Z-0.1 F5",
  ];
  var input = "G90\nG1 Z0.25 F20\nG0 X1.125 Y1.125 F10\nG1 Z-0.1 F5";
  QUnit.deepEqual(expected, extractCommandSequence(input));
});

QUnit.test("extractCommandSequence: one newlines", function() {
  var expected = [
    "G90",
    "G1 Z0.25 F20",
    "G0 X1.125 Y1.125 F10",
    "G1 Z-0.1 F5",
  ];
  var input = "G90 G1 Z0.25 F20 G0 X1.125 Y1.125 F10 G1 Z-0.1 F5";
  QUnit.deepEqual(expected, extractCommandSequence(input));
});
