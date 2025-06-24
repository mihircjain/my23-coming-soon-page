// MCP Client for Strava Data Integration
// Replaces Firestore-based Strava activity logic with MCP server endpoints

export interface McpResponse<T = any> {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
  data?: T;
}

export interface StravaActivity {
  id: string;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  average_speed: number;
  max_speed?: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  calories?: number;
  is_run_activity?: boolean;
  run_tag?: string;
  sport_type?: string;
}

export interface StravaActivityDetails extends StravaActivity {
  description?: string;
  splits_metric?: Array<{
    distance: number;
    elapsed_time: number;
    elevation_difference: number;
    moving_time: number;
    pace_zone: number;
    split: number;
    average_speed: number;
    average_heartrate?: number;
  }>;
  best_efforts?: any[];
  laps?: any[];
  zones?: any[];
  gear?: any;
  suffer_score?: number;
  achievement_count?: number;
  kudos_count?: number;
  comment_count?: number;
}

export interface StravaActivityStreams {
  time?: number[];
  distance?: number[];
  heartrate?: number[];
  velocity_smooth?: number[];
  altitude?: number[];
  cadence?: number[];
  watts?: number[];
  latlng?: [number, number][];
  temp?: number[];
  moving?: boolean[];
  grade_smooth?: number[];
}

export interface StravaAthleteProfile {
  id: number;
  firstname: string;
  lastname: string;
  username?: string;
  city?: string;
  state?: string;
  country?: string;
  sex?: string;
  weight?: number;
  measurement_preference: string;
  summit: boolean;
  profile_medium?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StravaAthleteStats {
  all_ride_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_run_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  all_swim_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
  };
  recent_ride_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  recent_run_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  recent_swim_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
  };
  ytd_ride_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_run_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    elevation_gain: number;
  };
  ytd_swim_totals?: {
    count: number;
    distance: number;
    moving_time: number;
    elapsed_time: number;
  };
}

export interface StravaAthleteZones {
  heart_rate?: {
    custom_zones: boolean;
    zones: Array<{
      min: number;
      max: number;
    }>;
  };
  power?: {
    zones: Array<{
      min: number;
      max: number;
    }>;
  };
}

// Helper to get environment variables safely in browser/server context
const getEnvVar = (key: string): string | undefined => {
  // Use globalThis to safely access environment variables
  const env = (globalThis as any).process?.env;
  return env?.[key];
};

class McpClient {
  private baseUrl: string;
  private accessToken?: string;

  constructor(baseUrl?: string, accessToken?: string) {
    this.baseUrl = baseUrl || getEnvVar('NEXT_PUBLIC_MCP_API_URL') || 'http://localhost:3001';
    this.accessToken = accessToken;
  }

  private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<McpResponse> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.accessToken) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`MCP API Error (${endpoint}):`, error);
      throw error;
    }
  }

  // Parse activity data from MCP text response
  private parseActivityData(textResponse: string): StravaActivity[] {
    const activities: StravaActivity[] = [];
    const lines = textResponse.split('\n');
    
    for (const line of lines) {
      if (line.includes('🏃') && line.includes('ID:')) {
        // Parse basic activity info from the text format
        // This is a simplified parser - in production you might want JSON responses
        const idMatch = line.match(/ID:\s*(\d+)/);
        const nameMatch = line.match(/🏃\s*([^(]+)/);
        
        if (idMatch && nameMatch) {
          activities.push({
            id: idMatch[1],
            name: nameMatch[1].trim(),
            type: 'Run', // Default, would need better parsing
            start_date: new Date().toISOString(), // Default, would need better parsing
            distance: 0, // Would need better parsing
            moving_time: 0, // Would need better parsing
            elapsed_time: 0,
            total_elevation_gain: 0,
            average_speed: 0,
            has_heartrate: false,
            is_run_activity: true,
          });
        }
      }
    }
    
    return activities;
  }

  // Get recent activities
  async getRecentActivities(perPage: number = 30): Promise<StravaActivity[]> {
    try {
      const response = await this.makeRequest('/tools/get-recent-activities', { perPage });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      const textResponse = response.content[0]?.text || '';
      return this.parseActivityData(textResponse);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      throw error;
    }
  }

  // Get activity details
  async getActivityDetails(activityId: string | number): Promise<StravaActivityDetails> {
    try {
      const response = await this.makeRequest('/tools/get-activity-details', { 
        activityId: typeof activityId === 'string' ? parseInt(activityId) : activityId 
      });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      const textResponse = response.content[0]?.text || '';
      
      // Parse the detailed activity response
      // This is a simplified parser - you might want to enhance this
      const activity: StravaActivityDetails = {
        id: activityId.toString(),
        name: 'Activity Details',
        type: 'Run',
        start_date: new Date().toISOString(),
        distance: 0,
        moving_time: 0,
        elapsed_time: 0,
        total_elevation_gain: 0,
        average_speed: 0,
        has_heartrate: false,
        is_run_activity: true,
      };

      // Enhanced parsing logic would go here
      // For now, return basic structure
      return activity;
    } catch (error) {
      console.error('Error fetching activity details:', error);
      throw error;
    }
  }

  // Get activity streams
  async getActivityStreams(
    activityId: string | number,
    types: string[] = ['time', 'distance', 'heartrate', 'velocity_smooth'],
    resolution?: 'low' | 'medium' | 'high'
  ): Promise<StravaActivityStreams> {
    try {
      const response = await this.makeRequest('/tools/get-activity-streams', {
        id: activityId,
        types,
        resolution,
      });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse streams data from response
      // This would need proper parsing implementation
      return {};
    } catch (error) {
      console.error('Error fetching activity streams:', error);
      throw error;
    }
  }

  // Get activity laps
  async getActivityLaps(activityId: string | number): Promise<any[]> {
    try {
      const response = await this.makeRequest('/tools/get-activity-laps', {
        activityId: typeof activityId === 'string' ? parseInt(activityId) : activityId,
      });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse laps data from response
      return [];
    } catch (error) {
      console.error('Error fetching activity laps:', error);
      throw error;
    }
  }

  // Get athlete profile
  async getAthleteProfile(): Promise<StravaAthleteProfile> {
    try {
      const response = await this.makeRequest('/tools/get-athlete-profile');
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      const textResponse = response.content[0]?.text || '';
      
      // Parse athlete profile from text response
      const profileMatch = textResponse.match(/Profile for (.+) \(ID: (\d+)\)/);
      if (profileMatch) {
        const [, name, id] = profileMatch;
        const [firstname, lastname] = name.split(' ');
        
        return {
          id: parseInt(id),
          firstname: firstname || '',
          lastname: lastname || '',
          measurement_preference: 'metric',
          summit: false,
        };
      }

      throw new Error('Unable to parse athlete profile');
    } catch (error) {
      console.error('Error fetching athlete profile:', error);
      throw error;
    }
  }

  // Get athlete stats
  async getAthleteStats(): Promise<StravaAthleteStats> {
    try {
      const response = await this.makeRequest('/tools/get-athlete-stats');
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse stats from response
      return {};
    } catch (error) {
      console.error('Error fetching athlete stats:', error);
      throw error;
    }
  }

  // Get athlete zones
  async getAthleteZones(): Promise<StravaAthleteZones> {
    try {
      const response = await this.makeRequest('/tools/get-athlete-zones');
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse zones from response
      return {};
    } catch (error) {
      console.error('Error fetching athlete zones:', error);
      throw error;
    }
  }

  // Explore segments
  async exploreSegments(bounds: [number, number, number, number], activityType?: string): Promise<any[]> {
    try {
      const response = await this.makeRequest('/tools/explore-segments', {
        bounds: bounds.join(','),
        activity_type: activityType,
      });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse segments from response
      return [];
    } catch (error) {
      console.error('Error exploring segments:', error);
      throw error;
    }
  }

  // Get segment details
  async getSegment(segmentId: string | number): Promise<any> {
    try {
      const response = await this.makeRequest('/tools/get-segment', {
        segmentId: typeof segmentId === 'string' ? parseInt(segmentId) : segmentId,
      });
      
      if (response.isError) {
        throw new Error(response.content[0]?.text || 'Unknown error');
      }

      // Parse segment from response
      return {};
    } catch (error) {
      console.error('Error fetching segment:', error);
      throw error;
    }
  }
}

// Create singleton instance
export const mcpClient = new McpClient();

// Export helper functions
export const setMcpAccessToken = (token: string) => {
  mcpClient['accessToken'] = token;
};

export const setMcpBaseUrl = (url: string) => {
  mcpClient['baseUrl'] = url;
};

export default mcpClient; 
