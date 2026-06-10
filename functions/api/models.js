import { getModelAvailability } from '../_lib/models.js';
import { jsonResponse } from '../_lib/utils.js';

export async function onRequestGet(context) {
  return jsonResponse({ models: getModelAvailability(context.env) });
}
