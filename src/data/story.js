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
  journal: [
    { who: "The Master's journal", text: 'The third name is in no tongue of this world. The Scroll shows it only beneath the star\'s light.' },
    { who: "The Master's journal", text: 'We found where the star came down. The snow there has turned to glass, and in the glass there is a door. Tonight I read the name to whatever sleeps behind it.' },
    { who: "The Master's journal", text: '(The last line shakes across the page.) The men will not stop screaming. I go on alone, to the fourth gate.' },
  ],
  bells: [
    { who: 'Temple notice', text: 'Three bells guard the inner hall: the bell of the gate, the bell of the cliff, the bell of the sky.' },
    { who: 'Temple notice', text: 'Strike all three, and the claws of the old masters are yours to bear. They will hold you to stone — and to ice.' },
  ],
  haiku: [{ who: 'Carved into the rail', text: 'Snow on the hot spring — / the old monkey shuts his eyes / and forgets the star.' }],
  patrol: [
    { who: 'A Binoshi diary', text: 'Second night on the slope. The snow hisses where the star cut through it. Kenta says it was a ship. Kenta says a lot of things.' },
    { who: 'A Binoshi diary', text: 'Something small ran across the snow tonight. Fast. Too many legs. Hiro went after it with a lantern.' },
    { who: 'A Binoshi diary', text: 'We found Hiro at dawn. He was smiling. Then he wasn\'t. His chest opened from the inside, and whatever it was went into the dark faster than we could follow.' },
  ],
  podlog: [
    { who: 'A screen in the lifeboat', text: 'MSV TETHYS · LIFEBOAT 2 · FLIGHT LOG. Launched 02:14. Hull breach, decks C through F. Specimen loose. Comms dead.' },
    { who: 'A screen in the lifeboat', text: 'Autopilot fault. Impact imminent. To whoever finds this: do not go into the Tethys. Do not take anything out of it.' },
    { who: '', text: 'The words mean nothing to you. The fear in them does.' },
  ],
  log1: [
    { who: "Captain's log · entry 41", text: 'We answered the other ship\'s beacon. It wasn\'t a distress call. It was a warning. It took us too long to work that out.' },
    { who: "Captain's log · entry 42", text: 'Ostrowski went inside it. Came back with something wrapped around his face. The company wants it brought home alive. I want it off my ship.' },
    { who: "Captain's log · entry 44", text: 'It\'s in the vents. Bigger every day. If we can drive it into the cargo bay, we can blow the outer door and let the drop take it.' },
  ],
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
  monk: { first: 'MONK', after: 'MONK_AFTER', auto: true },
  cocooned: { first: 'COCOONED', after: 'COCOONED_AFTER', auto: true },
};

// ── Chapter III — The Fallen Star ───────────────────────────
export const OPENING_3 = [
  'The line of light pointed east, into the mountains.',
  'Last winter, the villages said, a star fell there — and the snow around it never stopped glowing.',
  'The Binoshi climbed toward it. Few of them came back down.',
];

export const MONK = [
  { who: 'Old Monk', text: 'Oh! A living face. Sit, sit — the water is warm, and the monkeys don\'t mind company.' },
  { who: 'Old Monk', text: 'The star? It fell into the crater past the frozen falls. I went to see it. It is no star, child. Stars do not have doors.' },
  { who: 'Old Monk', text: 'Something came out of it. Something that takes people… into the walls. The Binoshi went in after it with their scroll. I heard them for three nights.' },
  { who: 'Old Monk', text: 'If you must go: climb the falls. The old masters\' claws will hold you to the ice. And keep your lantern close. It hates the light. A little.' },
];
export const MONK_AFTER = [{ who: 'Old Monk', text: 'Keep your lantern close.' }];

export const COCOONED = [
  { who: '…', text: '…you… you\'re not one of them… please…' },
  { who: 'Cocooned Binoshi', text: 'It takes us into the walls. The Master read the name in here and the whole ship OPENED. He didn\'t stay. The fourth gate, he said. The last name opens the sky.' },
  { who: 'Cocooned Binoshi', text: 'It\'s in the cargo bay. It\'s always in the cargo bay. Don\'t — there\'s something — something moving in my —' },
];
export const COCOONED_AFTER = [{ who: '', text: 'There is nothing left to say.' }];

export const BOSS_DEFEATED_3 = [
  { who: '', text: 'It claws at the deck, at the door, at you — and the night takes it. Its scream goes down and down into the crater, and stops.' },
  { who: '', text: 'The Tethys groans and settles. Through the open bay door, along the crater\'s rim, a trail of violet footprints leads away into the snow.' },
];

export const LAST_PAGE = [
  { who: '', text: 'A page torn from the Scroll, weighted under a stone. The Master meant for you to find it.' },
  { who: '', text: 'Four names. Three are struck through: the Balrog. The Beast of the Deep. The Thing from the Star. The fourth is not a name at all. It is a door.' },
  { who: '', text: 'Beneath, in the Master\'s hand: "There is a world beneath this one, where everything is turned upside down. The Mind Flayer waits there. I will let it in."' },
  { who: '', text: 'Above the ridge, for one heartbeat, the whole sky turns red.' },
];

export const CHAPTER_END_3 = {
  title: 'Chapter III Complete',
  sub: 'The Fallen Star',
  next: 'Next — The Upside Down',
};
