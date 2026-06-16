import { StagePage } from '../components/StagePage';
import { Card, CardBody } from '../components/ui/Card';
import { TextArea, TextInput } from '../components/ui/Field';
import { useProjectStore } from '../store/projectStore';

export function Engineering() {
  const engineering = useProjectStore((s) => s.project.engineering);
  const update = useProjectStore((s) => s.updateEngineering);

  return (
    <StagePage stageId="engineering">
      <Card>
        <CardBody className="space-y-5">
          <TextArea
            label="Ingestion"
            hint="How raw data lands from each source (e.g. CDC, batch extract, webhook)."
            placeholder={'Salesforce → Fivetran → raw.salesforce\nBilling API → daily batch → raw.billing'}
            value={engineering.ingestion}
            onChange={(e) => update({ ingestion: e.target.value })}
            rows={4}
          />
          <TextArea
            label="Transformation pipeline"
            hint="The staging → cleaning → conformed steps the Data Engineer Agent builds."
            placeholder={'stg_orders: dedupe + cast types\nint_orders_enriched: join customers\nmart_revenue: aggregate to daily grain'}
            value={engineering.pipeline}
            onChange={(e) => update({ pipeline: e.target.value })}
            rows={5}
          />
          <TextInput
            label="Refresh schedule"
            placeholder="e.g. Hourly incremental, full reload nightly at 02:00 UTC"
            value={engineering.schedule}
            onChange={(e) => update({ schedule: e.target.value })}
          />
          <TextArea
            label="Data quality & tests"
            placeholder={'not_null(order_id)\nunique(order_id)\nrow count within 5% of source'}
            value={engineering.quality}
            onChange={(e) => update({ quality: e.target.value })}
            rows={3}
          />
        </CardBody>
      </Card>
    </StagePage>
  );
}
