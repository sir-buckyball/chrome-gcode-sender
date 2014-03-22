// A small sketch to help test the gcode-sender without a real CNC machine.

void setup() {
  Serial.begin(9600);
  Serial.println("ok fake_gcode_intrepreter");
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') {
      Serial.write("ok\r\n");
      Serial.flush();
    } else if (c == '\n') {
      delay(500);
      Serial.write("ok\r\n");
      Serial.flush();
    } else if (c == '$') {
      Serial.write("helpful output\n");
      Serial.write("--------------\n");
      Serial.write("$  - this output\n");
      Serial.write("\\n - prints 'ok'\n");
    }
    Serial.flush();

    // TODO: validate gcode commands?
  }
}

