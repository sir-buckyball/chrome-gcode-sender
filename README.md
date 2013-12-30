chrome-gcode-sender
===================

What is this madness?
---------------------
**gcode-sender** is a chrome application capable of sending [gcode](http://en.wikipedia.org/wiki/Gcode) commands to a USB gcode intrepreter (hobby CNC machines / 3D printers).


Why did you do it?
------------------
I feel that [Chrome OS](http://en.wikipedia.org/wiki/Chrome_OS) machines have qualities which make them ideal in the machine shop. They are always up to date, secure, have only your cloud-stored files/applications available, relatively cheap, and easily swappable should something bad happen...

The common place alternative is an out of date Windows machine which is usually disconnected from the network, only has local accounts, and is running unknown (potentially malicious) software. Files are typically transferred by flash-drive-sneaker-net.


What libraries did you use?
---------------------------
* [paper.js](http://paperjs.org/) - canvas rendering library
* [Bootstrap](http://getbootstrap.com/) - layout library (makes things pretty)
* [Moment.js](http://momentjs.com/) - time library
* [jQuery](http://jquery.com/) - general javascript utilities
* [chrome.serial](http://developer.chrome.com/apps/serial.html) - chrome serial API


Are there any known issues?
---------------------------
Yes.
* UI doesn't always let the user know of an issue (check the chrome developer console)
* Sometimes chrome.serial doesn't obey the settings you ask for
  * try using 9600 baud
  * check the logs to see if it is forcing flow-control (happens on old Macs)
