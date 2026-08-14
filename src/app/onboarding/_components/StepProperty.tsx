import { labelClass, fieldClass } from "./fieldClass";
import type { LandContractInitialValues } from "./NewContractWizard";

export default function StepProperty({
  initial,
  highlightMissing,
}: {
  initial?: LandContractInitialValues;
  highlightMissing?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass} htmlFor="streetAddress">
          Street Address
        </label>
        <input
          id="streetAddress"
          name="streetAddress"
          type="text"
          required
          defaultValue={initial?.streetAddress ?? ""}
          className={fieldClass(initial?.streetAddress, highlightMissing)}
        />
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className={labelClass} htmlFor="city">
            City
          </label>
          <input
            id="city"
            name="city"
            type="text"
            required
            defaultValue={initial?.city ?? ""}
            className={fieldClass(initial?.city, highlightMissing)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="state">
            State
          </label>
          <input
            id="state"
            name="state"
            type="text"
            required
            defaultValue={initial?.state ?? ""}
            className={fieldClass(initial?.state, highlightMissing)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="zip">
            Zip
          </label>
          <input
            id="zip"
            name="zip"
            type="text"
            required
            defaultValue={initial?.zip ?? ""}
            className={fieldClass(initial?.zip, highlightMissing)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="county">
            County
          </label>
          <input
            id="county"
            name="county"
            type="text"
            required
            defaultValue={initial?.county ?? ""}
            className={fieldClass(initial?.county, highlightMissing)}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="propertyType">
            Type
          </label>
          <select
            id="propertyType"
            name="propertyType"
            required
            defaultValue={initial?.propertyType ?? "SINGLE_FAMILY"}
            className={fieldClass(true, false)}
          >
            <option value="SINGLE_FAMILY">SFR (Single Family Residential)</option>
            <option value="MULTI_FAMILY">Multi Family</option>
            <option value="COMMERCIAL">Commercial</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="parcelNumber">
          Parcel Number
        </label>
        <input
          id="parcelNumber"
          name="parcelNumber"
          type="text"
          defaultValue={initial?.parcelNumber ?? ""}
          className={fieldClass(initial?.parcelNumber, highlightMissing)}
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="legalDescription">
          Legal Description
        </label>
        <textarea
          id="legalDescription"
          name="legalDescription"
          rows={3}
          defaultValue={initial?.legalDescription ?? ""}
          className={fieldClass(initial?.legalDescription, highlightMissing)}
        />
      </div>
    </div>
  );
}
