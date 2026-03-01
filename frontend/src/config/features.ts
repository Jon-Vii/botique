export const frontendFeatures = {
  enableMockRunArtifacts:
    import.meta.env.VITE_ENABLE_MOCK_RUN_DATA === "true",
  enableRunLaunchControls:
    import.meta.env.VITE_ENABLE_RUN_LAUNCH_CONTROLS === "true",
} as const;
