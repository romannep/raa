var introValues = [
  'None',
  'Wind Of Change',
  'Mutter',
];

var rythmValues = [
  'None',
  'Wind Of Change',
  'Mutter',
  'Quantic',
  'Pink',
];

var introPatterns = [
  {},
  {
    length: 12,
    notes: [
      { step: 1, length: 1, pitch: 40 }, 
      { step: 4, length: 1, pitch: 40 },
      { step: 5, length: 1, pitch: 40 },
      { step: 7, length: 1, pitch: 36 },
      { step: 9, length: 1, pitch: 36 },
      { step: 10, length: 1, pitch: 36 },
      { step: 11, length: 1, pitch: 36 },
    ],
  },
  {
    length: 8,
    notes: [
      { step: 1, length: 1, pitch: 36 },
      { step: 2, length: 1, pitch: 40 },
      { step: 3, length: 1, pitch: 40 },
      { step: 5, length: 1, pitch: 36 },
      { step: 6, length: 1, pitch: 40 },
      { step: 7, length: 1, pitch: 40 },
      { step: 8, length: 1, pitch: 40 },
    ],
  }
];

var rythmPatterns = [
  {},
  {
    length: 16, // 2 tacts
    notes: [
      { step: 1, length: 1, pitch: 36 },
      { step: 5, length: 1, pitch: 40 },
      { step: 9, length: 1, pitch: 36 },
      { step: 11, length: 1, pitch: 36 },
      { step: 13, length: 1, pitch: 40 },
    ],
  },
  {
    length: 16, // 2 tacts
    notes: [
      { step: 1, length: 1, pitch: 36 },
      { step: 5, length: 1, pitch: 40 },
      { step: 9, length: 1, pitch: 36 },
      { step: 11, length: 1, pitch: 36 },
      { step: 13, length: 1, pitch: 40 },
    ],
  },
  {
    length: 8, // 2 tacts
    notes: [
      { step: 1, length: 1, pitch: 41 },
      { step: 3, length: 1, pitch: 41 },
      { step: 5, length: 1, pitch: 38 },
      { step: 7, length: 1, pitch: 41 },
      { step: 8, length: 1, pitch: 41 },
    ],
  },
  {
    length: 8, // 2 tacts
    notes: [
      { step: 1, length: 1, pitch: 36 },
      { step: 3, length: 1, pitch: 40 },
      { step: 4, length: 1, pitch: 36 },
      { step: 7, length: 1, pitch: 40 },
    ],
  }
];

var NeedsTimingInfo = true;

var itemsPerBeatValues = [0.125, 0.25, 0.5, 1, 2, 4, 8];
var started = false;
var start = 0; // beat position when performance started
var introPlaying = false;

function doStart(event) {
  const introIndex = GetParameter("Intro");
  if (introIndex > 0) {
    introPlaying = true;
  }
  started = true;
  start = event.beatPos;
}
function doStop() {
  started = false;
}

function HandleMIDI(event) {
  if (event instanceof NoteOn) {
    Trace("Pushed key with pitch " + event.pitch);

    var startKey = GetParameter("Start key pitch");
    var stopKey = GetParameter("Stop key pitch");
    var toggleKey = GetParameter("Toggle key pitch");

    if (event.pitch == startKey) {
      doStart(event);
    }
    if (event.pitch == stopKey) {
      doStop();
    }
    if (event.pitch == toggleKey) {
      if (started) {
        doStop();
      } else {
        doStart(event);
      }
    }

  }

}


function ProcessMIDI() {
  var musicInfo = GetTimingInfo();

  if (started) {

    var blockStart = musicInfo.blockStartBeat;
    var blockEnd = musicInfo.blockEndBeat;

    var itemsPerBeat = itemsPerBeatValues[GetParameter("Items per bit")];
    var noteLength = 1 / itemsPerBeat;

    var passedBeats = blockStart - start;
    var passedStepsInt = Math.floor(passedBeats * itemsPerBeat);

    var delta = blockEnd - blockStart;
    if (Math.abs(passedBeats) < delta) { // Initial start
      passedStepsInt = -1;
    }

    var pattern = {};
    if (introPlaying) {
      const introIndex = GetParameter("Intro");
      pattern = introPatterns[introIndex];

    } else {
      const rythmIndex = GetParameter("Rythm");
      pattern = rythmPatterns[rythmIndex];
    }

    var patternLength = pattern.length;

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = start + nextStepInt / itemsPerBeat;

    if ((blockStart <= nextBeat && nextBeat < blockEnd)) {
      Trace('intro ' + introPlaying + ' nextStepInt' + nextStepInt);
      // Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start + "drum intro" + drumIntro);
      if (nextStepInt == patternLength - 1) {
        // started = false;
        introPlaying = false;
        start = nextBeat + noteLength;
        // set start
        // checkAndStart(nextBeat + noteLength);
      }

      var notesToPlay = pattern.notes;
      Trace('index ' + nextStepInt + ' notes ' + JSON.stringify(notesToPlay));
      var notesToSend = [];
      for (var i = 0; i < notesToPlay.length; i++) {
        if (notesToPlay[i].step -1  == nextStepInt) {
          notesToSend.push(notesToPlay[i]);
        }
      }
      notesToSend.forEach((note) => {
        var noteOn = new NoteOn();
        noteOn.velocity = 120;
        noteOn.pitch = note.pitch;
        noteOn.isRealtime = true;
        notesToSend.push(noteOn);
        noteOn.sendAtBeat(nextBeat);
        var noteOff = new NoteOff(noteOn);
        noteOff.sendAtBeat(nextBeat + note.length * noteLength);
        Trace("sent " + note.pitch);
      });

    }

  }

}


var BaseParameters = [
  { name: "Intro", type: "menu", valueStrings: introValues.map(t => t.toString()), defaultValue: 0 },
  { name: "Rythm", type: "menu", valueStrings: rythmValues.map(t => t.toString()), defaultValue: 0 },

  { name: "Pattern length", type: "lin", minValue: 2, maxValue: 16, numberOfSteps: 14, defaultValue: 4 },
  { name: "Items per bit", type: "menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
  { name: "Start key pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Toggle key pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Stop key pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },

];




var PluginParameters = [].concat(BaseParameters);
