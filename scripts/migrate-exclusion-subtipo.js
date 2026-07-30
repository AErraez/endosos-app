// One-off migration: the exclusión feature originally pushed endoso entries
// with tipo: "modificacion de suma". That bucket was renamed to
// tipo: "movimiento de suma" with a "subtipo" field (inclusion | exclusion |
// modificacion de suma). Since exclusión was the only source of that tipo so
// far, every existing entry tagged "modificacion de suma" is retagged here as
// tipo: "movimiento de suma", subtipo: "exclusion".
//
// Usage: node --env-file=.env.local scripts/migrate-exclusion-subtipo.js
const { MongoClient } = require('mongodb');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('Please add your Mongo URI to .env.local');

    const client = new MongoClient(uri, {});
    await client.connect();
    const db = client.db('Data');

    const result = await db.collection('Polizas').updateMany(
        {},
        {
            $set: {
                'endosos.$[e].tipo': 'movimiento de suma',
                'endosos.$[e].subtipo': 'exclusion',
            },
        },
        { arrayFilters: [{ 'e.tipo': 'modificacion de suma' }] }
    );

    console.log(`Matched ${result.matchedCount} póliza(s), modified ${result.modifiedCount}.`);
    await client.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
