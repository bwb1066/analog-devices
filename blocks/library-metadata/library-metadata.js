// Library metadata is authoring-only (consumed by the DA block library), not page content.
export default function decorate(block) {
  block.setAttribute('aria-hidden', 'true');
}
