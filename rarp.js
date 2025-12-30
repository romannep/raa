
// release bass before end

var NeedsTimingInfo = true;

var itemsPerBeatValues = [0.125, 0.25, 0.5, 1, 2, 4, 8];
var activeNotes = []; // Currently pressed keys
var playingNotes = [];// To play when hand not holds keys
var started = false;
var start = 0; // beat position when performance started
var notesCountToStart = 3;

function getNoteIndexAndShift(patternValue) { // 0-7 - note index, -1 - chord
  if (patternValue > -1 && patternValue < 10) {
    return { index: patternValue, shift: 0 };
  }
  if (patternValue == 9) {
    return { index: -1, shift: 0 };
  }
  if (patternValue > 12 && patternValue < 20) {
    return { index: patternValue - 12, shift: 12 };
  }
  if (patternValue > -12 && patternValue < -3) {
    return { index: patternValue + 12, shift: -12 };
  }
  // if (patternValue < -11) {
  //   var pitch = Math.ceil(patternValue / 12);
  //   return { index: 0 - (patternValue % 12) -  1, shift: pitch };
  // }
  return { index: -1, shift: 0 };
}

// function checkAndStart(beatPos) {
//   if (activeNotes.length >= notesCountToStart && !started) {
//     started = true;
//     start = beatPos;
//     playingNotes = activeNotes.slice(0); 
//   }
// }

var drumIntro = false;

var released = false;
var activated = false;

function HandleMIDI(event) {
  if (event instanceof NoteOn) {
    var activateEdge = GetParameter("Activate edge");
    var lowEdge = GetParameter("Low edge");
    var resetPitch = GetParameter("Reset pitch");

    Trace("Pushed key with pitch " + event.pitch);
    if (activateEdge > 0) {
      if (event.pitch == resetPitch) {
        activated = false;
      }
      if (event.pitch >= activateEdge) {
        activated = true;
        return;
      }
      if (event.pitch <= lowEdge) {
        return;
      }
      if (!activated) {
        return;
      }

    }

    activeNotes.push(new NoteOn(event));

    var sortBy = GetParameter("Sort by");
    if (activeNotes.length > 2) {
      if (sortBy == 1) {
        activeNotes.sort(sortByPitchAscending);

        if (activeNotes[2].pitch - activeNotes[1].pitch > 4) {
          activeNotes.unshift(activeNotes.pop());
        }
        if (activeNotes[1].pitch - activeNotes[0].pitch > 4) {
          activeNotes.push(activeNotes.shift());
        }

      } else if (sortBy == 0) {
        activeNotes.sort(sortByPitchAscending);
      }
    }

    if (activeNotes.length >= notesCountToStart && (!started || released)) {
      started = true;
      released = false;
      start = event.beatPos;
      playingNotes = activeNotes.slice(0);

      if (playingNotes.length == 3) {
        var sortBy = GetParameter("Sort by");

        if (sortBy == 2) {
          Trace('Sort Chord and transpose');
          playingNotes.sort(sortByPitchAscending);
          if (playingNotes[2].pitch - playingNotes[1].pitch > 4) {
            var shifted = new NoteOn(playingNotes.shift());
            shifted.pitch = shifted.pitch + 12;
            playingNotes.push(shifted);

            shifted = new NoteOn(playingNotes.shift());
            shifted.pitch = shifted.pitch + 12;
            playingNotes.push(shifted);
          }
          if (playingNotes[1].pitch - playingNotes[0].pitch > 4) {
            const shifted = new NoteOn(playingNotes.shift());
            shifted.pitch = shifted.pitch + 12;
            playingNotes.push(shifted);
          }
        }

        var n4 = new NoteOn(playingNotes[0]);
        n4.pitch = n4.pitch + 12;
        playingNotes.push(n4);

        var n5 = new NoteOn(playingNotes[1]);
        n5.pitch = n5.pitch + 12;
        playingNotes.push(n5);

        var n6 = new NoteOn(playingNotes[2]);
        n6.pitch = n6.pitch + 12;
        playingNotes.push(n6);
      }
      Trace('Keys:' + playingNotes.map(n => n.pitch).join(','));

    }

    // checkAndStart(event.beatPos);
    // Trace("noteOn pitch=" + event.pitch + " now active: " + activeNotes.length + " started=" + started );
  }

  if (event instanceof NoteOff) {
    var noteIndex = activeNotes.findIndex(n => n.pitch == event.pitch);
    if (noteIndex > -1) {
      activeNotes.splice(noteIndex, 1);
    }
    if (activeNotes.length == 0) {
      released = true;
    }
  }

}


function sortByPitchAscending(a, b) {
  if (a.pitch < b.pitch) return -1;
  if (a.pitch > b.pitch) return 1;
  return 0;
}

var patternNotesCount = 0;

function getNoteOn(patternValue) {
  if (patternValue > 20) {
    var noteOn = new NoteOn;
    noteOn.pitch = patternValue;
    noteOn.velocity = 120;
    return noteOn;
  } else {
    var indexAndShift = getNoteIndexAndShift(patternValue);
    if (indexAndShift.index != -1) {
      var noteOn = new NoteOn(playingNotes[indexAndShift.index]);
      noteOn.pitch = noteOn.pitch + indexAndShift.shift;
      noteOn.velocity = 120;
      return noteOn;
    }
  }
}

var patternData = {};

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


    var patternLength = GetParameter("Pattern length");

    var nextStepInt = passedStepsInt + 1;
    var nextBeat = start + nextStepInt / itemsPerBeat;
    var nextStepIndex = nextStepInt % patternLength;

    if ((blockStart <= nextBeat && nextBeat < blockEnd)) {
      // Trace("passedStepsInt=" + passedStepsInt + " nextStepIndex=" + nextStepIndex + " bs=" + blockStart + " start=" + start + "drum intro" + drumIntro);
      if (nextStepIndex == patternLength - 1 && (GetParameter("Play while pressed") == 0 || released)) {
        started = false;
        // checkAndStart(nextBeat + noteLength);
      }

      var notesToPlay = patternData['step' + (nextStepIndex + 1)];
      Trace('index ' + nextStepIndex + ' step ' + 'step' + (nextStepIndex + 1) + ' notes ' + JSON.stringify(notesToPlay));
      if (notesToPlay && notesToPlay.length) {
        for (var i = 0; i < notesToPlay.length; i++) {
          var noteToPlay = notesToPlay[i];
          Trace('will play ' + JSON.stringify(noteToPlay));
          var notesToSend = [];

          if (noteToPlay.num == 9) {
            playingNotes.forEach((note) => {
              var noteOn = new NoteOn();
              noteOn.velocity = 120;
              noteOn.pitch = note.pitch;
              noteOn.isRealtime = true;
              notesToSend.push(noteOn);
            });
          } else {
            var indexAndShift = getNoteIndexAndShift(noteToPlay.num);
            Trace("i s " + indexAndShift.index + " sh " + indexAndShift.shift + " pN=" + playingNotes.map(n => n.pitch).join(','));
            if (indexAndShift.index != -1) {
              var noteOn = new NoteOn();
              noteOn.velocity = 120;
              noteOn.pitch = playingNotes[indexAndShift.index - 1].pitch + indexAndShift.shift;
              noteOn.isRealtime = true;
              notesToSend.push(noteOn);
            }
          }

          notesToSend.forEach((noteOn) => {
            noteOn.sendAtBeat(nextBeat);
            var noteOff = new NoteOff(noteOn);
            noteOff.sendAtBeat(nextBeat + noteLength * noteToPlay.length);
          });
        }

      }

    }

  }

}


var BaseParameters = [
  { name: "Sort by", type: "menu", valueStrings: ["Pitch", "Chord", "Chord transpose"], defaultValue: 0 },
  { name: "Pattern length", type: "lin", minValue: 2, maxValue: 16, numberOfSteps: 14, defaultValue: 4 },
  { name: "Items per bit", type: "menu", valueStrings: itemsPerBeatValues.map(t => t.toString()), defaultValue: 3 },
  { name: "Activate edge", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Low edge", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Reset pitch", type: "lin", minValue: 0, maxValue: 120, numberOfSteps: 120, defaultValue: 0 },
  { name: "Play while pressed", type: "checkbox" },
];

// TODO: Normalized chord index. One pattern can be used for differntly transposed chords.
var KeyParamters = [
  { name: 'Note', type: "text" },
  { name: "Step", type: "lin", minValue: 0, maxValue: 16, numberOfSteps: 16, defaultValue: 0 },
  { name: "Note length, steps", type: "lin", minValue: 1, maxValue: 16, numberOfSteps: 15, defaultValue: 1 },
  { name: "Note number", type: "lin", minValue: -11, maxValue: 9, numberOfSteps: 20, defaultValue: 0 }, // 9 - for whole chord
];


var stepNotes = [];
for (let i = 0; i < 20; i++) {
  stepNotes.push(0);
}

// UI

function stepNoteParamName(paramName, groupIndex) {
  return "(" + (groupIndex + 1) + ") " + paramName;
}

function fillPatternData() {
  patternData = {};
  for (noteIndex = 0; noteIndex < stepNotes.length; noteIndex++) {
    var num = GetParameter(stepNoteParamName("Note number", noteIndex));
    var step = GetParameter(stepNoteParamName("Step", noteIndex));

    if (step > 0) {
      var patternStepData = patternData['step' + step] || [];
      patternStepData.push({
        num: num,
        length: GetParameter(stepNoteParamName("Note length, steps", noteIndex)),
      });
      patternData['step' + step] = patternStepData;
    }
  }
  Trace('Pattern data ' + JSON.stringify(patternData));
}

function ParameterChanged(param, value) {
  fillPatternData();
}

var PluginParameters = [].concat(BaseParameters);
for (var i = 0; i < stepNotes.length; i++) {

  var noteParameters = KeyParamters.map(a => Object.assign({}, a));
  noteParameters.forEach(p => {
    p.name = stepNoteParamName(p.name, i);
  });

  PluginParameters = PluginParameters.concat(noteParameters);
}
fillPatternData();
