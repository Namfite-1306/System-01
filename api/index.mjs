import { waitUntil } from '@vercel/functions';
import { handleHosted } from '../lib/hosted.mjs';

export default async function handler(req, res) {
  return handleHosted(req, res, { defer: waitUntil });
}
