import { StagePage } from '../components/StagePage';
import { Card, CardBody } from '../components/ui/Card';
import { TextArea, TextInput, Select } from '../components/ui/Field';
import { useProjectStore } from '../store/projectStore';
import type { DashboardPlan } from '../store/types';

const LAYOUTS: { value: DashboardPlan['layout']; label: string }[] = [
  { value: 'single', label: 'Single focus' },
  { value: 'grid', label: 'Grid' },
  { value: 'narrative', label: 'Narrative / scrollytelling' },
];

export function Dashboard() {
  const dashboard = useProjectStore((s) => s.project.dashboard);
  const update = useProjectStore((s) => s.updateDashboard);

  return (
    <StagePage stageId="dashboard">
      <Card>
        <CardBody className="space-y-5">
          <TextInput
            label="Dashboard title"
            placeholder="e.g. Revenue Performance Dashboard"
            value={dashboard.title}
            onChange={(e) => update({ title: e.target.value })}
          />
          <Select
            label="Layout"
            value={dashboard.layout}
            onChange={(e) => update({ layout: e.target.value as DashboardPlan['layout'] })}
            className="sm:max-w-xs"
          >
            {LAYOUTS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
          <TextArea
            label="Widgets"
            hint="The charts, KPIs, and tables to include — one per line."
            placeholder={'KPI: Total revenue (YoY)\nLine: Revenue by month\nBar: Top 10 products'}
            value={dashboard.widgets}
            onChange={(e) => update({ widgets: e.target.value })}
            rows={5}
          />
          <TextArea
            label="Design notes"
            placeholder="Interactions, filters, drill-downs, branding…"
            value={dashboard.notes}
            onChange={(e) => update({ notes: e.target.value })}
            rows={3}
          />
        </CardBody>
      </Card>
    </StagePage>
  );
}
