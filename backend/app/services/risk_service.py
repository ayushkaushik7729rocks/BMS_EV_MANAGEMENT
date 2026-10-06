from dataclasses import dataclass


@dataclass(frozen=True)
class RiskAssessment:
    risk: str
    eta_minutes: float | None
    slope_c_per_minute: float | None
    explanation: str


def estimate_slope(samples: list[tuple[float, float]], minimum_span_seconds: float = 60.0) -> float | None:
    """Least-squares temperature slope from timestamp-seconds and Celsius samples."""
    if len(samples) < 3:
        return None
    times = [sample[0] for sample in samples]
    if max(times) - min(times) < minimum_span_seconds:
        return None
    mean_t = sum(times) / len(times)
    mean_y = sum(value for _, value in samples) / len(samples)
    denominator = sum((time - mean_t) ** 2 for time in times)
    if denominator == 0:
        return None
    slope_per_second = sum((time - mean_t) * (value - mean_y) for time, value in samples) / denominator
    return slope_per_second * 60.0


def assess_thermal_risk(
    current_temperature_c: float,
    predicted_temperature_c: float | None,
    samples: list[tuple[float, float]],
    threshold_c: float | None,
) -> RiskAssessment:
    if threshold_c is None:
        return RiskAssessment("UNCONFIGURED", None, None, "Set the cell manufacturer's thermal threshold before risk or ETA can be reported.")
    slope = estimate_slope(samples)
    if current_temperature_c >= threshold_c:
        return RiskAssessment("CRITICAL", 0.0, slope, "Current temperature has reached the configured threshold.")
    eta = None
    if slope is not None and slope > 0:
        eta = round(max(0.0, (threshold_c - current_temperature_c) / slope), 1)
    if predicted_temperature_c is not None and predicted_temperature_c >= threshold_c:
        risk = "HIGH"
        explanation = "The 10-minute temperature prediction reaches or exceeds the configured threshold."
    elif slope is not None and slope > 0:
        risk = "WARNING"
        explanation = "Temperature is rising; continue monitoring the estimated trend."
    else:
        risk = "NORMAL"
        explanation = "No rising temperature trend is available from the recent telemetry window."
    return RiskAssessment(risk, eta, slope, explanation)
