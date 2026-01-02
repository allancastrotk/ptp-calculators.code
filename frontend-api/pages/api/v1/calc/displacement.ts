import type { NextApiRequest, NextApiResponse } from "next";

import { isAllowedHost, isAllowedOrigin } from "@/lib/origin";
import { getInternalAuthHeaders } from "@/lib/internalAuth";
function applyCors(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const origin = req.headers.origin;
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      console.warn(`blocked origin: ${origin} host: ${req.headers.host || "<missing>"}`);
      return res.status(403).json({ error: "forbidden_origin" });
    }
  } else if (!isAllowedHost(req.headers.host)) {
    console.warn(`blocked origin: <missing> host: ${req.headers.host || "<missing>"}`);
    return res.status(403).json({ error: "forbidden_origin" });
  }

  applyCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const renderBase = process.env.RENDER_API_BASE || "";
  const auth = getInternalAuthHeaders();
  if (!renderBase || "error" in auth) {
    return res.status(500).json({ error: "server_misconfigured" });
  }

  const endpoint = renderBase.replace(/\/$/, "") + "/v1/calc/displacement";

  try {
    const upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...auth.headers,
      },
      body: JSON.stringify(req.body),
    });

    const body = await upstream.text();
    res.status(upstream.status);
    if (body) {
      res.setHeader("Content-Type", "application/json");
      return res.send(body);
    }
    return res.end();
  } catch (error) {
    return res.status(502).json({ error: "upstream_unavailable" });
  }
}