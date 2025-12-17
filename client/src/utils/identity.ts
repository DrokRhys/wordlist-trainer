const ADJECTIVES = [
    'Sleepy', 'Happy', 'Grumpy', 'Speedy', 'Exhausted',
    'Fluffy', 'Sneezy', 'Crazy', 'Cool', 'Wild',
    'Radioactive', 'Invisible', 'Neon', 'Brave', 'Lazy'
];
const NOUNS = [
    'Panda', 'Cactus', 'Badger', 'Potato', 'Unicorn',
    'Toaster', 'Ninja', 'Wizard', 'Robot', 'Pirate',
    'Hamster', 'Baguette', 'Duck', 'Raptor', 'Viking'
];

export function getDeviceId(): string {
    const KEY = 'magio_device_id';
    let id = localStorage.getItem(KEY);

    if (!id) {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        // Random 4 char hex/alphanum
        const hash = Math.random().toString(36).substring(2, 6);

        id = `${adj}${noun}_${hash}`;
        localStorage.setItem(KEY, id);
    }

    return id;
}
