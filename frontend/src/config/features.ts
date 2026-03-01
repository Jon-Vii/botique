export const frontendFeatures = {
  enableMockRunArtifacts:
    import.meta.env.VITE_ENABLE_MOCK_RUN_DATA === "true",
  enablePendingControlActions:
    import.meta.env.VITE_ENABLE_PENDING_CONTROL_ACTIONS === "true",
} as const;
