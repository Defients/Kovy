// ============================================================
// Motion tracking utilities — reserved for future native-side
// motion analysis enhancements (e.g. optical flow, GPU compute).
//
// Stable temporal region tracking is now implemented directly in
// capture.rs via centroid-distance matching with persistence,
// age, and missed-frame handling. This module is available for
// advanced enhancements like optical flow or GPU-accelerated
// analysis in future releases.
// ============================================================
