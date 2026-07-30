// One-off migration: tag every pre-existing endoso entry (which predates the
// "tipo" field introduced for the Exclusión feature) as tipo: "beneficiario",
// since they were all created through the old "Endoso beneficiario" flow.
//
// Usage: node --env-file=.env.local scripts/migrate-tipo-beneficiario.js
const { MongoClient } = require('mongodb');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('Please add your Mongo URI to .env.local');

    const client = new MongoClient(uri, {});
    await client.connect();
    const db = client.db('Data');

    const result = await db.collection('Polizas').updateMany(
        {},
        { $set: { 'endosos.$[e].tipo': 'beneficiario' } },
        { arrayFilters: [{ 'e.tipo': { $exists: false } }] }
    );

    console.log(`Matched ${result.matchedCount} póliza(s), modified ${result.modifiedCount}.`);
    await client.close();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
