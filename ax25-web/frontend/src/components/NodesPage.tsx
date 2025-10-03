import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Clock, Hash, ChevronLeft, ChevronRight, RefreshCw, AlertCircle, User, Settings } from 'lucide-react';
import { getApiEndpoint } from '../config/api';
import './NodesPage.css';

interface NodeRecord {
  callsign: string;
  latest_payload: string;
  last_timestamp: string;
  packet_type: string;
  first_seen: string;
}

interface NodePageData {
  nodes: NodeRecord[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    limit: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

const NodesPage: React.FC = () => {
  const [nodesData, setNodesData] = useState<NodePageData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNodes = async (page: number = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(getApiEndpoint(`/nodes?page=${page}&limit=30`));
      
      if (!response.ok) {
        throw new Error(`Failed to fetch nodes: ${response.statusText}`);
      }
      
      const data = await response.json();
      setNodesData(data);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch nodes');
      console.error('Error fetching nodes:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshNodes = async () => {
    try {
      setRefreshing(true);
      setError(null);
      
      // First refresh the database from the log file
      const refreshResponse = await fetch(getApiEndpoint('/nodes/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.json().catch(() => null);
        const errorMessage = errorData?.detail || `HTTP ${refreshResponse.status}: ${refreshResponse.statusText}`;
        throw new Error(errorMessage);
      }
      
      // Then fetch the updated data
      await fetchNodes(currentPage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to refresh nodes';
      setError(errorMessage);
      console.error('Error refreshing nodes:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNodes(1);
  }, []);

  const handlePageChange = (newPage: number) => {
    fetchNodes(newPage);
  };

  const formatTimestamp = (timestamp: string) => {
    // If timestamp is just HH:MM:SS format, return as is
    if (timestamp.match(/^\d{2}:\d{2}:\d{2}/)) {
      return timestamp;
    }
    
    // Try to parse as full datetime
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  const getPacketTypeColor = (packetType: string) => {
    switch (packetType) {
      case 'ID':
        return 'bg-blue-100 text-blue-800 border-blue-300 shadow-sm';
      case 'BEACON':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-sm';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300 shadow-sm';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg border p-8 text-center">
          <RefreshCw className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Nodes Database...</h2>
          <p className="text-gray-500 mt-2">Fetching ID and BEACON stations</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isConfigurationError = error.toLowerCase().includes('no log file configured');
    
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="w-full max-w-none px-6 py-6">
          <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {isConfigurationError ? 'Configuration Required' : 'Error Loading Nodes'}
              </h2>
              <p className="text-red-600 mb-6 max-w-2xl mx-auto">{error}</p>
              
              <div className="flex items-center justify-center gap-4">
                {isConfigurationError ? (
                  <Link
                    to="/config"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    <Settings className="h-4 w-4" />
                    Configure Log File
                  </Link>
                ) : (
                  <button
                    onClick={() => fetchNodes(currentPage)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                  >
                    Try Again
                  </button>
                )}
                
                <button
                  onClick={refreshNodes}
                  disabled={refreshing}
                  className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!nodesData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full max-w-none px-6 py-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Radio className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Nodes Database</h1>
                <p className="text-gray-600 mt-1">
                  Amateur radio stations that have sent ID or BEACON packets
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">
                  {nodesData?.pagination.total_count || 0}
                </div>
                <div className="text-sm text-gray-500">
                  Total Stations
                </div>
              </div>
              <button
                onClick={refreshNodes}
                disabled={refreshing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg"
              >
                <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Refreshing...' : 'Refresh Database'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Table Container */}
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 mb-6">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Station Activity</h2>
              <div className="text-blue-100 text-sm">
                {nodesData && (
                  <>
                    Showing {(currentPage - 1) * 30 + 1} - {Math.min(currentPage * 30, nodesData.pagination.total_count)} of {nodesData.pagination.total_count}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full nodes-table">
                <thead className="bg-blue-50 border-b border-blue-200">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        <User className="h-4 w-4" />
                        Call Sign
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        <Hash className="h-4 w-4" />
                        Type
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        Latest Payload
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        <Clock className="h-4 w-4" />
                        Last Heard
                      </div>
                    </th>
                    <th className="px-6 py-4 text-left">
                      <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 uppercase tracking-wider">
                        <Clock className="h-4 w-4" />
                        First Seen
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {nodesData?.nodes.map((node, index) => (
                    <tr 
                      key={node.callsign} 
                      className={`transition-colors hover:bg-blue-25 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="text-base font-semibold text-gray-900">
                            {node.callsign}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span 
                          className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold border ${getPacketTypeColor(node.packet_type)}`}
                        >
                          {node.packet_type}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 leading-relaxed max-w-2xl">
                          {node.latest_payload || (
                            <span className="text-gray-400 italic">No payload</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 font-mono">
                          {formatTimestamp(node.last_timestamp)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 font-mono">
                          {formatTimestamp(node.first_seen)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {nodesData && nodesData.pagination.total_pages > 1 && (
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                {/* Mobile Pagination */}
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={!nodesData.pagination.has_previous}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </button>
                  <span className="text-sm text-gray-700 px-4 py-2">
                    Page {currentPage} of {nodesData.pagination.total_pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={!nodesData.pagination.has_next}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>

                {/* Desktop Pagination */}
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{' '}
                      <span className="font-semibold text-blue-600">
                        {(currentPage - 1) * 30 + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-semibold text-blue-600">
                        {Math.min(currentPage * 30, nodesData.pagination.total_count)}
                      </span>{' '}
                      of{' '}
                      <span className="font-semibold text-blue-600">{nodesData.pagination.total_count}</span>{' '}
                      stations
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={!nodesData.pagination.has_previous}
                        className="relative inline-flex items-center px-3 py-2 rounded-l-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                      >
                        <ChevronLeft className="h-5 w-5" />
                        <span className="sr-only">Previous</span>
                      </button>
                      
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, nodesData.pagination.total_pages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(
                          nodesData.pagination.total_pages - 4,
                          currentPage - 2
                        )) + i;
                        
                        if (pageNum > nodesData.pagination.total_pages) return null;
                        
                        return (
                          <button
                            key={pageNum}
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors ${
                              pageNum === currentPage
                                ? 'z-10 bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      
                      <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={!nodesData.pagination.has_next}
                        className="relative inline-flex items-center px-3 py-2 rounded-r-lg border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-blue-50 hover:text-blue-600 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                      >
                        <span className="sr-only">Next</span>
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Empty State */}
        {nodesData && nodesData.nodes.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-12 text-center">
            <div className="p-4 bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
              <Radio className="h-10 w-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No Stations Found</h3>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              No amateur radio stations have sent ID or BEACON packets yet. Try refreshing the database or check your log file configuration.
            </p>
            <button
              onClick={refreshNodes}
              disabled={refreshing}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-md hover:shadow-lg"
            >
              {refreshing ? 'Refreshing...' : 'Refresh Database'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodesPage;