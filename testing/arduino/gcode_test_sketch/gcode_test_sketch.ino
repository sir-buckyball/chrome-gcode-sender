// A small sketch to help test the gcode-sender without a real CNC machine.

void setup() {
  Serial.begin(9600);
  Serial.println("ok fake_gcode_intrepreter");
}

void loop() {
  if (Serial.available()) {
    if (Serial.read() == '\n') {
      delay(500);
      Serial.write("ok\n");
    }
    
    // TODO: validate gcode commands?
  }
}

