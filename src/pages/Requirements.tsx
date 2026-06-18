import { BrdGenerator } from '../components/brd/BrdGenerator';

/**
 * The Business Requirements tab is the BRD Generator (spec 2.x): a domain-aware
 * Business Requirements Document builder with a review-and-revise loop and a
 * Word export. It is the first feature tab inside the application shell.
 */
export function Requirements() {
  return <BrdGenerator />;
}
