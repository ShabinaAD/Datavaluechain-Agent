import { StagePage } from '../components/StagePage';
import { Card, CardBody } from '../components/ui/Card';
import { TextArea, TextInput } from '../components/ui/Field';
import { useProjectStore } from '../store/projectStore';

export function Requirements() {
  const requirements = useProjectStore((s) => s.project.requirements);
  const update = useProjectStore((s) => s.updateRequirements);

  return (
    <StagePage stageId="requirements">
      <Card>
        <CardBody className="space-y-5">
          <TextInput
            label="Business objective"
            placeholder="What decision or outcome should this enable?"
            value={requirements.objective}
            onChange={(e) => update({ objective: e.target.value })}
          />
          <TextInput
            label="Primary audience"
            placeholder="e.g. Regional sales leadership"
            value={requirements.audience}
            onChange={(e) => update({ audience: e.target.value })}
          />
          <TextArea
            label="Key questions to answer"
            hint="The questions the dashboard must answer, one per line."
            placeholder={'How is revenue trending by region?\nWhich segments are churning?'}
            value={requirements.keyQuestions}
            onChange={(e) => update({ keyQuestions: e.target.value })}
            rows={4}
          />
          <TextArea
            label="Success metrics"
            placeholder="How will we know this delivers value?"
            value={requirements.successMetrics}
            onChange={(e) => update({ successMetrics: e.target.value })}
            rows={3}
          />
        </CardBody>
      </Card>
    </StagePage>
  );
}
