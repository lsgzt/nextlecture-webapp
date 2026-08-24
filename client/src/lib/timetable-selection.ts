export function getPreferredTimetableGroup(profileSubsection: string | null | undefined, routeGroup: string | null, storedGroup: string | null) {
  const normalizedSubsection = profileSubsection?.trim().toUpperCase();
  if (normalizedSubsection) return normalizedSubsection;
  return routeGroup?.trim().toUpperCase() || storedGroup?.trim().toUpperCase() || null;
}
