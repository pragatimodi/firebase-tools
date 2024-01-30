import * as proto from "../gcp/proto";
import { Client } from "../apiv2";
import { needProjectId } from "../projectUtils";
import { apphostingOrigin } from "../api";
import { ensure } from "../ensureApiEnabled";
import { Cat, DeepOmit, RecursiveKeyOf, assertImplements } from "../metaprogramming";

export const API_HOST = new URL(apphostingOrigin).host;
export const API_VERSION = "v1alpha";

const client = new Client({
  urlPrefix: apphostingOrigin,
  auth: true,
  apiVersion: API_VERSION,
});

type BuildState = "BUILDING" | "BUILD" | "DEPLOYING" | "READY" | "FAILED";

interface Codebase {
  repository?: string;
  rootDirectory: string;
}

/**
 * Specifies how Backend's data is replicated and served.
 *   GLOBAL_ACCESS: Stores and serves content from multiple points-of-presence (POP)
 *   REGIONAL_STRICT: Restricts data and serving infrastructure in Backend's region
 *
 */
export type ServingLocality = "GLOBAL_ACCESS" | "REGIONAL_STRICT";

/** A Backend, the primary resource of Frameworks. */
export interface Backend {
  name: string;
  mode?: string;
  codebase: Codebase;
  servingLocality: ServingLocality;
  labels: Record<string, string>;
  createTime: string;
  updateTime: string;
  uri: string;
}

export type BackendOutputOnlyFields = "name" | "createTime" | "updateTime" | "uri";

assertImplements<BackendOutputOnlyFields, RecursiveKeyOf<Backend>>();

export interface Build {
  name: string;
  state: BuildState;
  error: Status;
  image: string;
  config?: BuildConfig;
  source: BuildSource;
  sourceRef: string;
  buildLogsUri?: string;
  displayName?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uuid: string;
  etag: string;
  reconciling: boolean;
  createTime: string;
  updateTime: string;
  deleteTime: string;
}

export type BuildOutputOnlyFields =
  | "state"
  | "error"
  | "image"
  | "sourceRef"
  | "buildLogsUri"
  | "reconciling"
  | "uuid"
  | "etag"
  | "createTime"
  | "updateTime"
  | "deleteTime"
  | "source.codebase.displayName"
  | "source.codebase.hash"
  | "source.codebase.commitMessage"
  | "source.codebase.uri"
  | "source.codebase.commitTime";

assertImplements<BuildOutputOnlyFields, RecursiveKeyOf<Build>>();

export interface BuildConfig {
  minInstances?: number;
  memory?: string;
}

interface BuildSource {
  codebase: CodebaseSource;
}

interface CodebaseSource {
  // oneof reference
  branch?: string;
  commit?: string;
  tag?: string;
  // end oneof reference
  displayName: string;
  hash: string;
  commitMessage: string;
  uri: string;
  commitTime: string;
}

interface Status {
  code: number;
  message: string;
  details: unknown;
}

type RolloutState =
  | "STATE_UNSPECIFIED"
  | "QUEUED"
  | "PENDING_BUILD"
  | "PROGRESSING"
  | "PAUSED"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface Rollout {
  name: string;
  state: RolloutState;
  paused?: boolean;
  pauseTime: string;
  error?: Error;
  build: string;
  stages?: RolloutStage[];
  displayName?: string;
  createTime: string;
  updateTime: string;
  deleteTime?: string;
  purgeTime?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  uid: string;
  etag: string;
  reconciling: boolean;
}

export type RolloutOutputOnlyFields =
  | "state"
  | "pauseTime"
  | "createTime"
  | "updateTime"
  | "deleteTime"
  | "purgeTime"
  | "uid"
  | "etag"
  | "reconciling";

assertImplements<RolloutOutputOnlyFields, RecursiveKeyOf<Rollout>>();

export interface Traffic {
  name: string;
  // oneof traffic_management
  target?: TrafficSet;
  rolloutPolicy?: RolloutPolicy;
  // end oneof traffic_management
  current: TrafficSet;
  reconciling: boolean;
  createTime: string;
  updateTime: string;
  annotations?: Record<string, string>;
  etag: string;
  uid: string;
}

export type TrafficOutputOnlyFields =
  | "current"
  | "reconciling"
  | "createTime"
  | "updateTime"
  | "etag"
  | "uid"
  | "rolloutPolicy.disabledTime"
  | "rolloutPolicy.stages.startTime"
  | "rolloutPolicy.stages.endTime";

assertImplements<TrafficOutputOnlyFields, RecursiveKeyOf<Traffic>>();

export interface TrafficSet {
  splits: TrafficSplit[];
}

export interface TrafficSplit {
  build: string;
  percent: number;
}

export interface RolloutPolicy {
  // oneof trigger
  codebaseBranch?: string;
  codebaseTagPattern?: string;
  // end oneof trigger
  stages?: RolloutStage[];
  disabled?: boolean;

  // TODO: This will be undefined if disabled is not true, right?
  disabledTime: string;
}

export type RolloutProgression =
  | "PROGRESSION_UNSPECIFIED"
  | "IMMEDIATE"
  | "LINEAR"
  | "EXPONENTIAL"
  | "PAUSE";

export interface RolloutStage {
  progression: RolloutProgression;
  duration?: {
    seconds: number;
    nanos: number;
  };
  targetPercent?: number;
  startTime: string;
  endTime: string;
}

interface OperationMetadata {
  createTime: string;
  endTime: string;
  target: string;
  verb: string;
  statusDetail: string;
  cancelRequested: boolean;
  apiVersion: string;
}

export interface Operation {
  name: string;
  metadata?: OperationMetadata;
  done: boolean;
  // oneof result
  error?: Status;
  response?: any;
  // end oneof result
}

export interface ListBackendsResponse {
  backends: Backend[];
}

/**
 * Creates a new Backend in a given project and location.
 */
export async function createBackend(
  projectId: string,
  location: string,
  backendReqBoby: DeepOmit<Backend, BackendOutputOnlyFields>,
  backendId: string,
): Promise<Operation> {
  const res = await client.post<DeepOmit<Backend, BackendOutputOnlyFields>, Operation>(
    `projects/${projectId}/locations/${location}/backends`,
    backendReqBoby,
    { queryParams: { backendId } },
  );

  return res.body;
}

/**
 * Gets backend details.
 */
export async function getBackend(
  projectId: string,
  location: string,
  backendId: string,
): Promise<Backend> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}`;
  const res = await client.get<Backend>(name);
  return res.body;
}

/**
 * List all backends present in a project and region.
 */
export async function listBackends(
  projectId: string,
  location: string,
): Promise<ListBackendsResponse> {
  const name = `projects/${projectId}/locations/${location}/backends`;
  const res = await client.get<ListBackendsResponse>(name);

  return res.body;
}

/**
 * Deletes a backend with backendId in a given project and location.
 */
export async function deleteBackend(
  projectId: string,
  location: string,
  backendId: string,
): Promise<Operation> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}`;
  const res = await client.delete<Operation>(name, { queryParams: { force: "true" } });

  return res.body;
}

/**
 * Get a Build by Id
 */
export async function getBuild(
  projectId: string,
  location: string,
  backendId: string,
  buildId: string,
): Promise<Build> {
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/builds/${buildId}`;
  const res = await client.get<Build>(name);
  return res.body;
}

/**
 * Creates a new Build in a given project and location.
 */
export async function createBuild(
  projectId: string,
  location: string,
  backendId: string,
  buildId: string,
  buildInput: DeepOmit<Build, BuildOutputOnlyFields | "name">,
): Promise<Operation> {
  const res = await client.post<DeepOmit<Build, BuildOutputOnlyFields | "name">, Operation>(
    `projects/${projectId}/locations/${location}/backends/${backendId}/builds`,
    buildInput,
    { queryParams: { buildId } },
  );
  return res.body;
}

/**
 * Create a new rollout for a backend.
 */
export async function createRollout(
  projectId: string,
  location: string,
  backendId: string,
  rolloutId: string,
  rollout: DeepOmit<Rollout, RolloutOutputOnlyFields | "name">,
): Promise<Operation> {
  const res = await client.post<DeepOmit<Rollout, RolloutOutputOnlyFields | "name">, Operation>(
    `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts`,
    rollout,
    { queryParams: { rolloutId } },
  );
  return res.body;
}

/**
 * List all rollouts for a backend.
 */
export async function listRollouts(
  projectId: string,
  location: string,
  backendId: string,
): Promise<Rollout[]> {
  const res = await client.get<{ rollouts: Rollout[] }>(
    `projects/${projectId}/locations/${location}/backends/${backendId}/rollouts`,
  );
  return res.body.rollouts;
}

/**
 * Update traffic of a backend.
 */
export async function updateTraffic(
  projectId: string,
  location: string,
  backendId: string,
  traffic: DeepOmit<Traffic, TrafficOutputOnlyFields | "name">,
): Promise<Operation> {
  // BUG(b/322891558): setting deep fields on rolloutPolicy doesn't work for some
  // reason. Create a copy without deep fields to force the updateMask to be
  // correct.
  const trafficCopy = { ...traffic };
  if ("rolloutPolicy" in traffic) {
    trafficCopy.rolloutPolicy = {} as any;
  }
  const fieldMasks = proto.fieldMasks(trafficCopy);
  const queryParams = {
    updateMask: fieldMasks.join(","),
  };
  const name = `projects/${projectId}/locations/${location}/backends/${backendId}/traffic`;
  const res = await client.patch<DeepOmit<Traffic, TrafficOutputOnlyFields>, Operation>(
    name,
    { ...traffic, name },
    {
      queryParams,
    },
  );
  return res.body;
}

export interface Location {
  name: string;
  locationId: string;
}

interface ListLocationsResponse {
  locations: Location[];
  nextPageToken?: string;
}

/**
 * Lists information about the supported locations.
 */
export async function listLocations(projectId: string): Promise<Location[]> {
  let pageToken;
  let locations: Location[] = [];
  do {
    const response = await client.get<ListLocationsResponse>(`projects/${projectId}/locations`);
    if (response.body.locations && response.body.locations.length > 0) {
      locations = locations.concat(response.body.locations);
    }
    pageToken = response.body.nextPageToken;
  } while (pageToken);
  return locations;
}

/**
 * Ensure that the App Hosting API is enabled on the project.
 */
export async function ensureApiEnabled(options: any): Promise<void> {
  const projectId = needProjectId(options);
  return await ensure(projectId, API_HOST, "app hosting", true);
}
