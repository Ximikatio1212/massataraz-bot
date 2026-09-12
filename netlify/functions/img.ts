import { Handler } from "@netlify/functions";
import { getObject } from "../../src/services/storage.service";

export const handler: Handler = async (event) => {
  const key = (event.queryStringParameters?.k ?? "").trim();
  if (!key) {
    return { statusCode: 400, body: "bad request" };
  }
  const obj = await getObject(key);
  if (!obj) {
    return { statusCode: 404, body: "not found" };
  }
  return {
    statusCode: 200,
    headers: {
      "Content-Type": obj.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
    body: obj.data.toString("base64"),
    isBase64Encoded: true,
  };
};