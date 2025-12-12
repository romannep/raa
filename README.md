# Roman's Arpeggiator and Auto Accompaniment for Mainstage 3

Arpeggiator and Auto Accompaniment for keys for Mainstage

## Arpeggiator (rarp.js)

- Starts, when pressed 3+ keys
- Plays entire pattern, do not stop if keys released
- Stops after pattern played one
- While playing, stops when pressed another 3+ keys and starts playing new pattern


You specify:
- note number in chord to play
   - notes sorted by pitch or by chord
- `9` to play whole chord
- `13` - `20` - note number in chord transposed +octave (`13` for 1, `14` for 2, and so on)
- `-11` - `-4` - note number in chord transposed -octave (`-11` for 1, `-10` for 2, and so on)

TODO: specify how many times pattern should be repeated (1-12)


## Repeater (rrep.js)

- You specify exact pitch for every note in pattern
- Starts by key with specified pitch
- Repeat pattern endless
- Stops by key with specified pitch



