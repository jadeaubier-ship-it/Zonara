type GeocodingResult = {
  latitude: number;
  longitude: number;
};

export async function geocodeFrenchCity(input: {
  city: string;
  zipcode?: string;
}): Promise<GeocodingResult | null> {
  try {
    const params = new URLSearchParams({
      q: `${input.city} ${input.zipcode ?? ""}`.trim(),
      limit: "1"
    });

    if (input.zipcode) {
      params.set("postcode", input.zipcode);
    }

    const response = await fetch(`https://api-adresse.data.gouv.fr/search/?${params.toString()}`, {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };

    const coordinates = data.features?.[0]?.geometry?.coordinates;

    if (!coordinates || coordinates.length < 2) {
      return null;
    }

    return {
      longitude: coordinates[0],
      latitude: coordinates[1]
    };
  } catch {
    return null;
  }
}
