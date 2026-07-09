import dns from 'dns';
import { MongoClient } from 'mongodb';

// Node's resolver can fail SRV lookups (ECONNREFUSED) when the OS hands it a
// link-local IPv6 DNS server (common with VPNs/virtual adapters). Force a
// public resolver so mongodb+srv:// lookups work regardless of local network config.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const uri = process.env.MONGODB_URI; // Your string from the Atlas "Drivers" screen
const options = {};

let client;
let clientPromise;

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

if (process.env.NODE_ENV === 'development') {
  // In development, use a global variable so the connection isn't reset on every refresh
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;