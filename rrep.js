var NeedsTimingInfo = true;

var startPos = 0;
var inProgress = false;
var patternTaken = false;
var playing = false;
var pattern = [];
var activated = false;

function HandleMIDI(event) {
  if (event instanceof NoteOn) {
    if (GetParameter("Activate pitch") > 0) {
      if (GetParameter("Activate pitch") == event.pitch) {
        activated = true;
      }
      if (!activated) {
        return;
      }
    }
    if (event.pitch == GetParameter("Toggle pitch")) {
      playing = !playing;
      return;
    }
    if (event.pitch == GetParameter("Reset pitch")) {
      patternTaken = false;
      activated = false;
      pattern = [];
      return;
    }

    if (!patternTaken && !inProgress) {
      inProgress = true;
      startPos = event.beatPos;
    }
    if (inProgress) {
      pattern.push(event);
      Trace('pushed key ' + event.beatPos + " pitch " + event.pitch);
      event.sendAtBeat(event.beatPos);
    }
  }
}

function ProcessMIDI() {
  var musicInfo = GetTimingInfo();

  var patternLength = GetParameter('Pattern length');


  var blockStart = musicInfo.blockStartBeat;
  var blockEnd = musicInfo.blockEndBeat;

  if (inProgress && (blockEnd > startPos + patternLength)) {
    if (inProgress) {
      inProgress = false;
      patternTaken = true;
      Trace("collected " + pattern);
      playing = true;
    }
  }

  var passed = blockEnd - startPos;
  var patternsPassed = Math.floor(passed / patternLength);
  if (playing && patternsPassed > 0) {
    var patternBlockStart = blockStart - patternsPassed * patternLength
    var patternBlockEnd = blockEnd - patternsPassed * patternLength

    pattern.forEach((noteEvent) => {
      if (noteEvent.beatPos > patternBlockStart && noteEvent.beatPos < patternBlockEnd) {
        var noteOn = new NoteOn();
        noteOn.velocity = noteEvent.velocity;
        noteOn.pitch = noteEvent.pitch;
        noteOn.isRealtime = true;
        noteOn.sendAtBeat(noteEvent.beatPos + patternsPassed*patternLength);
        var noteOff = new NoteOff(noteOn);
        noteOff.sendAtBeat(noteEvent.beatPos + patternsPassed*patternLength + noteEvent.length);
      }
    });
  }


}


var BaseParameters = [
  { name: "Pattern length", type: "lin", minValue: 1, maxValue: 128, numberOfSteps: 127, defaultValue: 4 },
  { name: "Toggle pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Reset pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Activate pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
];
var PluginParameters = [].concat(BaseParameters);
