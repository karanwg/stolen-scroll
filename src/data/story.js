// All story text in one place, so it's easy to rewrite.

export const OPENING = [
  'For three hundred years, the village of Kagari kept the Ancient Scroll.',
  'Its pages hold the names of things that should stay asleep.',
  'Tonight, the Binoshi — shinobi who sold their shadows — came for it.',
  'They read one name aloud. And the sky over Kagari caught fire.',
];

export const ELDER = [
  { who: 'Elder Haru', text: '…You came back. Good. Good. Kneel a moment — I cannot stand.' },
  { who: 'Elder Haru', text: 'The Binoshi took the Scroll. They used it to call up a demon of fire… a Balrog, from beyond the western sea.' },
  { who: 'Elder Haru', text: 'It is what burned us. But it is only the first. They mean to wake something far older — the Mind Flayer.' },
  { who: 'Elder Haru', text: 'Follow their tracks. Their feet leave a violet stain — the Scroll\'s ink is on their souls now.' },
  { who: 'Elder Haru', text: 'Rest at the spirit lanterns when you can. They will remember you if you fall. Go.' },
];

export const ELDER_AFTER = [{ who: 'Elder Haru', text: 'The tracks lead through the village. Go, child.' }];

export const NOTES = {
  orders: [
    { who: 'Binoshi orders', text: 'Second name: the Beast of the Deep. Read it at the Floating Shrine when the tide is high.' },
    { who: 'Binoshi orders', text: 'Take every boat in Ama. Leave none to follow us. If the beast is hungry, let it eat the village first. — The Master' },
  ],
  log: [
    { who: "Captain's log", text: 'Day 3. Jellies thick as rice in the cove. Old Rokubei swears a man can bounce off them with a stick. Fool.' },
    { who: "Captain's log", text: 'Day 4. Saw Rokubei do it. Seven jellies, straight up the lighthouse rock, laughing the whole way.' },
    { who: "Captain's log", text: 'Day 9. The water is wrong tonight. Something keeps knocking on the hull from underneath.' },
  ],
  keeper: [
    { who: "Keeper's note", text: 'My father flew the kite-cloth over the strait every spring. It hangs by the lamp now. Hold it with hands and feet and let the wind decide.' },
    { who: "Keeper's note", text: 'Where the sea turns white, nothing walks. Not boat, not bird, not man. Fly over it, or go around.' },
  ],
  tracks: [
    { who: 'Violet footprints', text: 'Still glowing. They lead east, through the burning street. Whoever made them was in no hurry.' },
  ],
  sensei: [
    { who: "Sensei's note", text: 'If you are reading this, the dojo has fallen. Take the Tengu Feather from the altar.' },
    { who: "Sensei's note", text: 'The pagoda can be climbed by one who can leap twice. From its roof, the Binoshi\'s path is plain to see.' },
  ],
};

export const BOSS_INTRO = { name: 'BALROG', title: 'The Flame that Took Kagari' };

export const BOSS_DEFEATED = [
  { who: '', text: 'The demon\'s fire gutters out. In the ash, something glints — a torn strip of scroll-paper, its ink still wet.' },
  { who: '', text: 'One name has been struck through. Three remain. The last is written in a hand you do not recognise, and it hurts to look at.' },
  { who: '', text: 'Beyond the sealed gate, the violet tracks continue — east, toward the sea.' },
];

export const CHAPTER_END = {
  title: 'Chapter I Complete',
  sub: 'Kagari Village',
  next: 'Next — The Drowned Coast',
};

export const LANTERN_FIRST = [{ who: '', text: 'You kneel before the spirit lantern. Its flame takes your breath, and gives it back steadier. (Hearts restored · Progress saved)' }];

// ── Chapter II — The Drowned Coast ──────────────────────────
export const OPENING_2 = [
  'The violet tracks led on, down the cliffs, to the sea.',
  'The fishing village of Ama had gone quiet. No lamps. No boats.',
  'Out past the lighthouse, something vast was turning in its sleep.',
];

export const FERRYMAN = [
  { who: 'Old Ferryman', text: 'A ninja, out of the smoke. From Kagari? Then you saw the fire. I am sorry, child.' },
  { who: 'Old Ferryman', text: 'They came through two nights ago — masks, and that purple ink on their heels. Took every boat in Ama and rowed for the Floating Shrine.' },
  { who: 'Old Ferryman', text: 'Then the sea stood up. Arms, child. Arms as long as the harbour. It pulled the boats under, and our fishermen with them.' },
  { who: 'Old Ferryman', text: 'No boats left to lend you. But a shinobi never needed a boat, eh? Here — my grandfather\'s mizugumo. Water-spider shoes.' },
  { who: 'Old Ferryman', text: 'Run and the sea holds you. Stand still and it remembers you\'re heavy. And where the water turns white — don\'t.' },
];
export const FERRYMAN_AFTER = [{ who: 'Old Ferryman', text: 'Keep your feet moving. The lighthouse keeper kept something for crossing the rough water. Climb the light.' }];

export const WOUNDED = [
  { who: 'Wounded Binoshi', text: '…Hah. The Kagari brat. Come to finish me? Don\'t bother. The beast did that.' },
  { who: 'Wounded Binoshi', text: 'We read its name, and it came — and it didn\'t care whose boat it was breaking. The Master didn\'t even look back.' },
  { who: 'Wounded Binoshi', text: 'He took the Scroll east. To where the star fell last winter. Said the third name doesn\'t belong to this world at all.' },
  { who: 'Wounded Binoshi', text: 'Go on, then. It\'s out there past the gate. It\'s always out there.' },
];
export const WOUNDED_AFTER = [{ who: 'Wounded Binoshi', text: '…still here? It\'s waiting.' }];

export const BOSS_DEFEATED_2 = [
  { who: '', text: 'The great eye closes. The arms slide back into the black water, and for the first time in two nights the sea lies still.' },
  { who: '', text: 'The whitecaps fade. The water is calm enough to walk on now — and on the far rocks, something is glinting.' },
];

export const RELIC = [
  { who: '', text: 'It is not shell, and not stone: a curved plate of seamless silver, warm to the touch. It hums.' },
  { who: '', text: 'Across it, in Binoshi ink, a third name has been written. It hurts to look at. Beneath it, a thin line of light points east — to where the star fell.' },
];

export const CHAPTER_END_2 = {
  title: 'Chapter II Complete',
  sub: 'The Drowned Coast',
  next: 'Next — The Fallen Star',
};

export const NPCS = {
  elder: { first: 'ELDER', after: 'ELDER_AFTER', auto: true },
  ferryman: { first: 'FERRYMAN', after: 'FERRYMAN_AFTER', auto: true, gives: 'waterWalk' },
  binoshi: { first: 'WOUNDED', after: 'WOUNDED_AFTER', auto: true },
};
