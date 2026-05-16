const { MongoClient, ObjectId } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  
  // Find all sessions
  const sessions = await db.collection("session").find({}).toArray();
  console.log(`Found ${sessions.length} sessions`);
  
  if (sessions.length > 1) {
     // delete all except one for the user just to clean up 
     const keep = sessions[0];
     for(let i=1; i<sessions.length; i++) {
        await db.collection("session").deleteOne({ _id: sessions[i]._id });
        console.log("Deleted session:", sessions[i]._id);
     }
  }

  await client.close();
}

main().catch(console.error);
