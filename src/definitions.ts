import axios from "axios";
import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { CACHE_FILE, DEFAULT_TAG_DEFINITIONS_URL, DEFAULT_VALUESET_URLS } from "./constants.js";
import { CachedDefinitions, ResolvedConfig } from "./types.js";

const readCache = (root: string): CachedDefinitions | undefined => {
  const cachePath = path.join(root, CACHE_FILE);
  if (!fs.existsSync(cachePath)) return undefined;
  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    return JSON.parse(raw) as CachedDefinitions;
  } catch {
    return undefined;
  }
};

const writeCache = (root: string, data: CachedDefinitions) => {
  const cachePath = path.join(root, CACHE_FILE);
  fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
};

const isExpired = (fetchedAt: string, ttlMinutes: number): boolean => {
  const then = new Date(fetchedAt).getTime();
  const now = Date.now();
  return now - then > ttlMinutes * 60 * 1000;
};

export const loadDefinitions = async (projectRoot: string, config: ResolvedConfig, logger: any) => {
  const cached = readCache(projectRoot);
  if (cached && !isExpired(cached.fetchedAt, config.cacheTtlMinutes)) {
    logger.debug({ msg: "Using cached OLI tag definitions" });
    return { tagDefinitions: cached.tagDefinitions, valueSets: cached.valueSets };
  }

  const tagUrl = config.tagDefinitionsUrl || DEFAULT_TAG_DEFINITIONS_URL;
  // allow offline mode by setting tagDefinitionsUrl to empty string
  if (!tagUrl) {
    logger.warn({ msg: "Tag definitions URL not set; running in offline mode with empty definitions." });
    return { tagDefinitions: {}, valueSets: {} };
  }
  const valueSetUrls = config.valueSetUrls || DEFAULT_VALUESET_URLS;

  let tagRes;
  let ownerProjectRes;
  let usageCategoryRes;
  try {
    [tagRes, ownerProjectRes, usageCategoryRes] = await Promise.all([
      axios.get(tagUrl),
      valueSetUrls.owner_project ? axios.get(valueSetUrls.owner_project) : Promise.resolve(undefined),
      valueSetUrls.usage_category ? axios.get(valueSetUrls.usage_category) : Promise.resolve(undefined)
    ]);
  } catch (err) {
    logger.warn({ msg: "Failed to fetch tag definitions or value sets; proceeding with empty definitions", err: String(err) });
    return { tagDefinitions: {}, valueSets: {} };
  }

  const parsedTags = yaml.load(tagRes.data as string) as any;
  const tagDefinitions = (parsedTags?.tags || []).reduce((acc: any, entry: any) => {
    acc[entry.tag_id] = entry;
    return acc;
  }, {});

  const valueSets: Record<string, any> = {};
  if (ownerProjectRes?.data) {
    valueSets["owner_project"] = (ownerProjectRes.data?.data?.data || []).map((i: any) =>
      Array.isArray(i) ? String(i[0]).toLowerCase() : String(i).toLowerCase()
    );
  }
  if (usageCategoryRes?.data) {
    const parsedUsage = yaml.load(usageCategoryRes.data as string) as any;
    valueSets["usage_category"] = (parsedUsage?.categories || []).map((c: any) =>
      String(c.category_id).toLowerCase()
    );
  }

  writeCache(projectRoot, {
    fetchedAt: new Date().toISOString(),
    tagDefinitions,
    valueSets
  });

  return { tagDefinitions, valueSets };
};
