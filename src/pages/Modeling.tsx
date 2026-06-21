import { ModelGenerator } from '../components/model/ModelGenerator';

/**
 * The Modeling tab is the Conceptual Data Modeler (spec 3.x): it reads the
 * generated BRD and produces a rigorous, domain-aware conceptual data model —
 * business entities and relationships — with an ER diagram and version history.
 */
export function Modeling() {
  return <ModelGenerator />;
}
