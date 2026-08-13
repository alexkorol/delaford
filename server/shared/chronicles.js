export const HOUSE_NAME_MIN = 3;
export const HOUSE_NAME_MAX = 20;
export const SCION_NAME_MIN = 2;
export const SCION_NAME_MAX = 20;

const validateName = (name, {
  label,
  minimum,
  maximum,
}) => {
  const value = String(name || '').trim();

  if (value.length < minimum) {
    return { valid: false, reason: `${label} must be at least ${minimum} characters.` };
  }

  if (value.length > maximum) {
    return { valid: false, reason: `${label} must be ${maximum} characters or fewer.` };
  }

  return { valid: true, value };
};

export const validateHouseName = name => validateName(name, {
  label: 'House name',
  minimum: HOUSE_NAME_MIN,
  maximum: HOUSE_NAME_MAX,
});

export const validateScionName = name => validateName(name, {
  label: 'Scion name',
  minimum: SCION_NAME_MIN,
  maximum: SCION_NAME_MAX,
});

export default {
  HOUSE_NAME_MIN,
  HOUSE_NAME_MAX,
  SCION_NAME_MIN,
  SCION_NAME_MAX,
  validateHouseName,
  validateScionName,
};
