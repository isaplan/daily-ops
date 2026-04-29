import { MongoClient } from "mongodb";

const uri = "mongodb+srv://daily-ops:fP4A82x5c6u17CI3@twacc-products-9d9ef48a.mongo.ondigitalocean.com/daily-ops-db?authSource=admin&replicaSet=twacc-products&tls=true";
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db("daily-ops-db");
  const cronJobs = db.collection("integration_cron_jobs");
  
  console.log("🔍 integration_cron_jobs collection status:\n");
  
  const jobs = await cronJobs.find({}).sort({ createdAt: -1 }).toArray();
  
  jobs.forEach((job, i) => {
    const createdAt = job.createdAt ? new Date(job.createdAt).toISOString() : "N/A";
    const completedAt = job.completedAt ? new Date(job.completedAt).toISOString() : "N/A";
    console.log(`${i + 1}. ${job.jobType} (${job.source})`);
    console.log(`   Status: ${job.status || 'unknown'}`);
    console.log(`   Created: ${createdAt}`);
    console.log(`   Completed: ${completedAt}`);
    if (job.error) console.log(`   Error: ${job.error}`);
    console.log();
  });
  
} catch (error) {
  console.error("❌ Error:", error.message);
} finally {
  await client.close();
}
