const { Client } = require("minio");
const client = new Client({
  endPoint: "402bc27451417472f192b91dd58da5b0.r2.cloudflarestorage.com",
  port: 443,
  useSSL: true,
  accessKey: "9116b164803d9996e0a1cd0d2a11ceb1",
  secretKey: "aa0fc9fec1ad79e32c9c66acf26449bcf8e8640918050a207d9a3f8b37ad1a40",
});
(async () => {
  const bucket = "massataraz-media";
  const exists = await client.bucketExists(bucket).then(()=>true).catch(()=>false);
  console.log("bucket exists:", exists);
  if (!exists) {
    await client.makeBucket(bucket, "");
    console.log("bucket created");
  }
  await client.putObject(bucket, "test/hello.txt", Buffer.from("ok"), 2, { "Content-Type": "text/plain" });
  console.log("test upload ok");
  const obj = await client.statObject(bucket, "test/hello.txt");
  console.log("stat ok:", obj.size, obj.etag);
  await client.removeObject(bucket, "test/hello.txt");
  console.log("cleaned");
})().catch((e) => { console.error("ERR", e && e.message ? e.message : e); process.exit(1); });