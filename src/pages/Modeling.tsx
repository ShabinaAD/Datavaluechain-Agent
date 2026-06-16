import { StagePage } from '../components/StagePage';
import { Card, CardBody } from '../components/ui/Card';
import { TextArea, TextInput } from '../components/ui/Field';
import { useProjectStore } from '../store/projectStore';

export function Modeling() {
  const modeling = useProjectStore((s) => s.project.modeling);
  const update = useProjectStore((s) => s.updateModeling);

  return (
    <StagePage stageId="modeling">
      <Card>
        <CardBody className="space-y-5">
          <TextInput
            label="Grain"
            hint="The level of detail of one row in the model."
            placeholder="e.g. One row per order line per day"
            value={modeling.grain}
            onChange={(e) => update({ grain: e.target.value })}
          />
          <TextArea
            label="Dimensions"
            placeholder={'date\nregion\nproduct\ncustomer_segment'}
            value={modeling.dimensions}
            onChange={(e) => update({ dimensions: e.target.value })}
            rows={4}
          />
          <TextArea
            label="Measures"
            placeholder={'revenue\nunits_sold\ngross_margin'}
            value={modeling.measures}
            onChange={(e) => update({ measures: e.target.value })}
            rows={3}
          />
          <TextArea
            label="Transformations"
            hint="Cleaning, joins, and derivations the Data Engineer Agent should apply."
            placeholder="Describe the pipeline steps…"
            value={modeling.transformations}
            onChange={(e) => update({ transformations: e.target.value })}
            rows={4}
          />
        </CardBody>
      </Card>
    </StagePage>
  );
}
