// A small sketch to help test the gcode-sender without a real CNC machine.

void setup() {
  Serial.begin(9600);
  Serial.println("ok fake_gcode_intrepreter");
}

// The grbl board writes responses 4 characters at a
// time. This function attempts to simulate that.
void grblWrite(char* str) {
  int i = 0;
  while (str[i] != '\0') {
    Serial.write(str[i]);
    if (i % 4 == 3) {
      Serial.flush();
      delay(100);
    }
    i++;
  }
  Serial.flush();
}

void loop() {
  if (Serial.available()) {
    char c = Serial.read();
    if (c == '\r') {
      Serial.write("ok\r\n");
      Serial.flush();
    } else if (c == '\n') {
      delay(100);
      Serial.write("ok\r\n");
      Serial.flush();
    } else if (c == '$') {
      grblWrite(
          "helpful output\r\n"
          "--------------\r\n"
          "$  - this output\r\n"
          "\\n - prints 'ok'\r\n"
          "\r\n"
          "one fish, two fish, red fish, blue fish,\r\n"
          "black fish, blue fish, old fish, new fish.\r\n"
          "this one has a little car.\r\n"
          "this one has a little star.\r\n"
          "say! what a lot of thish there are.\r\n");
    }
    Serial.flush();

    // TODO: validate gcode commands?
  }
}

