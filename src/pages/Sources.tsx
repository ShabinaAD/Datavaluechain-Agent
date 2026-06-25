import { useState } from 'react';
import { StagePage } from '../components/StagePage';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TextInput, Select, TextArea } from '../components/ui/Field';
import { ConnectFirst } from '../components/ConnectFirst';
import { FileUpload } from '../components/FileUpload';
import { useProjectStore } from '../store/projectStore';
import type { ConnectorConfig, ConnectorPlatform, DataSource } from '../store/types';
import { PlusIcon, TrashIcon, SourcesIcon } from '../icons';

function deriveColumns(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const cols = firstLine
    .split(/[,\t]/)
    .map((c) => c.trim())
    .filter(Boolean);
  return cols.length ? `Columns: ${cols.join(', ')}` : 'Imported sample file.';
}

const CONNECTOR_TEMPLATES: {
  platform: ConnectorPlatform;
  label: string;
  icon: string;
  kind: DataSource['kind'];
  description: string;
  color: string;
  defaultConfig: ConnectorConfig;
}[] = [
  {
    platform: 'snowflake',
    label: 'Snowflake',
    icon: 'SF',
    kind: 'warehouse',
    description: 'Cloud data warehouse with auto-scaling compute and time-travel.',
    color: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-200',
    defaultConfig: {
      account: '',
      warehouse: 'COMPUTE_WH',
      database: '',
      schema: 'PUBLIC',
      role: 'SYSADMIN',
      username: '',
    },
  },
  {
    platform: 'databricks',
    label: 'Databricks',
    icon: 'DB',
    kind: 'warehouse',
    description: 'Unified analytics platform with Delta Lake, SQL warehouse, and ML runtime.',
    color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200',
    defaultConfig: {
      workspaceUrl: '',
      httpPath: '',
      catalog: 'main',
      database: 'default',
      username: '',
    },
  },
  {
    platform: 'azure-synapse',
    label: 'Azure Synapse',
    icon: 'SY',
    kind: 'warehouse',
    description: 'Enterprise analytics service with dedicated/serverless SQL pools.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200',
    defaultConfig: {
      serverName: '',
      database: '',
      schema: 'dbo',
      username: '',
    },
  },
  {
    platform: 'azure-data-lake',
    label: 'Azure Data Lake',
    icon: 'DL',
    kind: 'file',
    description: 'Scalable cloud storage with hierarchical namespace (ADLS Gen2).',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200',
    defaultConfig: {
      storageAccount: '',
      container: '',
    },
  },
  {
    platform: 'azure-sql',
    label: 'Azure SQL',
    icon: 'AZ',
    kind: 'database',
    description: 'Managed SQL Server database in Azure with built-in intelligence.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200',
    defaultConfig: {
      serverName: '',
      database: '',
      schema: 'dbo',
      username: '',
      port: '1433',
    },
  },
  {
    platform: 'aws-s3',
    label: 'AWS S3',
    icon: 'S3',
    kind: 'file',
    description: 'Object storage for data lakes, staging, and raw file ingestion.',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    defaultConfig: {
      region: 'us-east-1',
      bucketName: '',
      accessKeyId: '',
    },
  },
  {
    platform: 'aws-redshift',
    label: 'AWS Redshift',
    icon: 'RS',
    kind: 'warehouse',
    description: 'Petabyte-scale cloud data warehouse with columnar storage.',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    defaultConfig: {
      clusterIdentifier: '',
      database: '',
      schema: 'public',
      region: 'us-east-1',
      port: '5439',
      username: '',
    },
  },
  {
    platform: 'aws-glue',
    label: 'AWS Glue',
    icon: 'GL',
    kind: 'database',
    description: 'Serverless ETL and data catalog service for AWS.',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200',
    defaultConfig: {
      region: 'us-east-1',
      glueDatabase: '',
      accessKeyId: '',
    },
  },
];

const PLATFORM_FIELDS: Record<ConnectorPlatform, { key: keyof ConnectorConfig; label: string; placeholder: string }[]> = {
  snowflake: [
    { key: 'account', label: 'Account', placeholder: 'xy12345.us-east-1' },
    { key: 'warehouse', label: 'Warehouse', placeholder: 'COMPUTE_WH' },
    { key: 'database', label: 'Database', placeholder: 'ANALYTICS_DB' },
    { key: 'schema', label: 'Schema', placeholder: 'PUBLIC' },
    { key: 'role', label: 'Role', placeholder: 'SYSADMIN' },
    { key: 'username', label: 'Username', placeholder: 'svc_account' },
  ],
  databricks: [
    { key: 'workspaceUrl', label: 'Workspace URL', placeholder: 'https://adb-123456.azuredatabricks.net' },
    { key: 'httpPath', label: 'HTTP Path', placeholder: '/sql/1.0/warehouses/abc123' },
    { key: 'catalog', label: 'Catalog', placeholder: 'main' },
    { key: 'database', label: 'Database / Schema', placeholder: 'default' },
    { key: 'username', label: 'Username / Token ID', placeholder: 'token' },
  ],
  'azure-synapse': [
    { key: 'serverName', label: 'Server Name', placeholder: 'mysynapse.sql.azuresynapse.net' },
    { key: 'database', label: 'Database', placeholder: 'synapse_pool' },
    { key: 'schema', label: 'Schema', placeholder: 'dbo' },
    { key: 'username', label: 'Username', placeholder: 'sqladmin' },
  ],
  'azure-data-lake': [
    { key: 'storageAccount', label: 'Storage Account', placeholder: 'mydatalake' },
    { key: 'container', label: 'Container', placeholder: 'raw-data' },
  ],
  'azure-sql': [
    { key: 'serverName', label: 'Server Name', placeholder: 'myserver.database.windows.net' },
    { key: 'database', label: 'Database', placeholder: 'mydb' },
    { key: 'schema', label: 'Schema', placeholder: 'dbo' },
    { key: 'port', label: 'Port', placeholder: '1433' },
    { key: 'username', label: 'Username', placeholder: 'sqladmin' },
  ],
  'aws-s3': [
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'bucketName', label: 'Bucket Name', placeholder: 'my-data-bucket' },
    { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
  ],
  'aws-redshift': [
    { key: 'clusterIdentifier', label: 'Cluster Identifier', placeholder: 'my-redshift-cluster' },
    { key: 'database', label: 'Database', placeholder: 'analytics' },
    { key: 'schema', label: 'Schema', placeholder: 'public' },
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'port', label: 'Port', placeholder: '5439' },
    { key: 'username', label: 'Username', placeholder: 'admin' },
  ],
  'aws-glue': [
    { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    { key: 'glueDatabase', label: 'Glue Database', placeholder: 'my_glue_db' },
    { key: 'accessKeyId', label: 'Access Key ID', placeholder: 'AKIA...' },
  ],
  generic: [
    { key: 'host', label: 'Host', placeholder: 'localhost' },
    { key: 'port', label: 'Port', placeholder: '5432' },
    { key: 'database', label: 'Database', placeholder: 'mydb' },
    { key: 'username', label: 'Username', placeholder: 'user' },
    { key: 'connectionString', label: 'Connection String', placeholder: 'jdbc:...' },
  ],
};

function buildConnectionString(platform: ConnectorPlatform, config: ConnectorConfig): string {
  switch (platform) {
    case 'snowflake':
      return `snowflake://${config.username || '<user>'}@${config.account || '<account>'}/${config.database || '<db>'}/${config.schema || 'PUBLIC'}?warehouse=${config.warehouse || 'COMPUTE_WH'}&role=${config.role || 'SYSADMIN'}`;
    case 'databricks':
      return `databricks://${config.workspaceUrl || '<workspace>'}${config.httpPath || ''}?catalog=${config.catalog || 'main'}&schema=${config.database || 'default'}`;
    case 'azure-synapse':
      return `sqlserver://${config.serverName || '<server>'}/${config.database || '<db>'}?schema=${config.schema || 'dbo'}`;
    case 'azure-data-lake':
      return `abfss://${config.container || '<container>'}@${config.storageAccount || '<account>'}.dfs.core.windows.net/`;
    case 'azure-sql':
      return `sqlserver://${config.serverName || '<server>'}:${config.port || '1433'}/${config.database || '<db>'}`;
    case 'aws-s3':
      return `s3://${config.bucketName || '<bucket>'}/?region=${config.region || 'us-east-1'}`;
    case 'aws-redshift':
      return `redshift://${config.clusterIdentifier || '<cluster>'}.${config.region || 'us-east-1'}.redshift.amazonaws.com:${config.port || '5439'}/${config.database || '<db>'}`;
    case 'aws-glue':
      return `glue://${config.region || 'us-east-1'}/${config.glueDatabase || '<db>'}`;
    default:
      return config.connectionString || '';
  }
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  configured: { label: 'Configured', color: 'bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-200' },
  untested: { label: 'Not tested', color: 'bg-stone-100 text-stone-600 dark:bg-stone-900/50 dark:text-stone-300' },
  connected: { label: 'Connected', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200' },
  error: { label: 'Error', color: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-200' },
};

function ConnectorCard({
  source,
  index,
  onUpdate,
  onRemove,
}: {
  source: DataSource;
  index: number;
  onUpdate: (id: string, patch: Partial<DataSource>) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const template = CONNECTOR_TEMPLATES.find((t) => t.platform === source.platform);
  const fields = PLATFORM_FIELDS[source.platform] ?? PLATFORM_FIELDS.generic;
  const statusInfo = STATUS_BADGE[source.status] ?? STATUS_BADGE.untested;

  const handleConfigChange = (key: keyof ConnectorConfig, value: string) => {
    const newConfig = { ...source.config, [key]: value };
    const newConn = buildConnectionString(source.platform, newConfig);
    onUpdate(source.id, { config: newConfig, connection: newConn, status: 'configured' });
  };

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2">
            {template && (
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold ${template.color}`}>
                {template.icon}
              </span>
            )}
            <span>{source.name || `Source ${index + 1}`}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
        }
        action={
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="px-2 text-content-muted"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(source.id)}
              aria-label="Remove source"
              className="px-2 text-content-muted hover:text-red-600"
            >
              <TrashIcon width={16} height={16} />
            </Button>
          </div>
        }
      />
      {expanded && (
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              label="Name"
              placeholder={template ? `e.g. ${template.label} Production` : 'e.g. My Database'}
              value={source.name}
              onChange={(e) => onUpdate(source.id, { name: e.target.value })}
            />
            <Select
              label="Connector"
              value={source.platform}
              onChange={(e) => {
                const newPlatform = e.target.value as ConnectorPlatform;
                const tmpl = CONNECTOR_TEMPLATES.find((t) => t.platform === newPlatform);
                onUpdate(source.id, {
                  platform: newPlatform,
                  kind: tmpl?.kind ?? source.kind,
                  config: tmpl?.defaultConfig ?? {},
                  connection: '',
                  status: 'untested',
                });
              }}
            >
              <optgroup label="Snowflake">
                <option value="snowflake">Snowflake</option>
              </optgroup>
              <optgroup label="Databricks">
                <option value="databricks">Databricks</option>
              </optgroup>
              <optgroup label="Azure">
                <option value="azure-synapse">Azure Synapse</option>
                <option value="azure-data-lake">Azure Data Lake</option>
                <option value="azure-sql">Azure SQL</option>
              </optgroup>
              <optgroup label="AWS">
                <option value="aws-s3">AWS S3</option>
                <option value="aws-redshift">AWS Redshift</option>
                <option value="aws-glue">AWS Glue</option>
              </optgroup>
              <optgroup label="Other">
                <option value="generic">Generic / Custom</option>
              </optgroup>
            </Select>
          </div>

          <div className="rounded-lg border border-border bg-surface-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-content-muted">
              {template?.label ?? 'Generic'} Configuration
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((f) => (
                <TextInput
                  key={f.key}
                  label={f.label}
                  placeholder={f.placeholder}
                  value={(source.config[f.key] as string) ?? ''}
                  onChange={(e) => handleConfigChange(f.key, e.target.value)}
                />
              ))}
            </div>
          </div>

          {source.connection && (
            <div>
              <label className="field-label">Connection string (auto-generated)</label>
              <div className="rounded-lg border border-border bg-stone-900 px-3 py-2 text-xs font-mono text-stone-200 break-all">
                {source.connection}
              </div>
            </div>
          )}

          <TextArea
            label="Notes"
            placeholder="Refresh cadence, owners, caveats…"
            value={source.notes}
            onChange={(e) => onUpdate(source.id, { notes: e.target.value })}
            rows={2}
          />

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const conn = buildConnectionString(source.platform, source.config);
              const hasFields = Object.values(source.config).some((v) => typeof v === 'string' && v.trim());
              onUpdate(source.id, {
                connection: conn,
                status: hasFields ? 'configured' : 'untested',
              });
            }}
          >
            Test connection
          </Button>
        </CardBody>
      )}
    </Card>
  );
}

export function Sources() {
  const sources = useProjectStore((s) => s.project.sources);
  const importSource = useProjectStore((s) => s.importSource);
  const updateSource = useProjectStore((s) => s.updateSource);
  const removeSource = useProjectStore((s) => s.removeSource);

  const [showTemplates, setShowTemplates] = useState(false);

  function addFromTemplate(platform: ConnectorPlatform) {
    const tmpl = CONNECTOR_TEMPLATES.find((t) => t.platform === platform);
    if (!tmpl) return;
    importSource({
      name: `${tmpl.label} Source`,
      kind: tmpl.kind,
      platform: tmpl.platform,
      config: { ...tmpl.defaultConfig },
      connection: '',
      status: 'untested',
    });
    setShowTemplates(false);
  }

  return (
    <StagePage stageId="sources">
      <div className="mb-6 space-y-4">
        <ConnectFirst
          service="Database"
          hint="Set DATABASE_URL on the server to enable live connections. You can keep designing your sources now — your work is saved."
        />
        <FileUpload
          uploadKey="sources"
          onDerive={({ name, text }) =>
            importSource({
              name,
              kind: 'file',
              platform: 'generic',
              connection: name,
              config: {},
              notes: deriveColumns(text),
              status: 'configured',
            })
          }
        />
      </div>

      {/* Connector template picker */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-content">Data Source Connectors</h2>
          <Button
            onClick={() => setShowTemplates(!showTemplates)}
            leftIcon={<PlusIcon width={16} height={16} />}
          >
            Add connector
          </Button>
        </div>

        {showTemplates && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {CONNECTOR_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.platform}
                type="button"
                onClick={() => addFromTemplate(tmpl.platform)}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-4 text-left shadow-card transition-all hover:border-brand-500 hover:shadow-md"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${tmpl.color}`}>
                    {tmpl.icon}
                  </span>
                  <span className="text-sm font-semibold text-content">{tmpl.label}</span>
                </div>
                <p className="text-xs text-content-muted">{tmpl.description}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Configured sources */}
      {sources.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-muted text-content-subtle">
              <SourcesIcon width={24} height={24} />
            </span>
            <div>
              <p className="font-medium text-content">No data sources yet</p>
              <p className="text-sm text-content-muted">
                Click <strong>"Add connector"</strong> above to connect to Snowflake, Databricks, Azure,
                or AWS, or import a file.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {sources.map((source, i) => (
            <ConnectorCard
              key={source.id}
              source={source}
              index={i}
              onUpdate={updateSource}
              onRemove={removeSource}
            />
          ))}
        </div>
      )}
    </StagePage>
  );
}
