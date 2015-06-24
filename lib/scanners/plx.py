from __future__ import print_function 
import os.path
import copy
import re 
import json
import sys 


import pkg_resources 



installed_packages = dict([(p.project_name.lower(),p) for p in pkg_resources.working_set])
packages_already_seen = set() 

def contains_legal_metadata(file_name): 
	"""
	Checks whether the indicated file name matches with common names for relevant license documents 
	"""
	metadata_regex = re.compile("(LICENSE) | (PKG-INFO) | (README)",re.VERBOSE)
	return metadata_regex.search(file_name) is not None

def has_been_seen(package): 
	return package.project_name.lower() not in packages_already_seen

def find_package_info(name):
	"""
	Uses pip to do a breadth-first search for dependency file locations; significant portions 
	are straight from the pip show command 
	"""
	global packages_already_seen
	if name.lower() not in installed_packages: 
		return None 
	package = installed_packages[name.lower()]
	packages_already_seen |= set([name.lower()])
	package_info = { 
		"name": package.project_name, 
		"version": package.version, 
		"location": package.location 
	}
	file_list_path = os.path.join(
				 package.location,
				 package.egg_name() + ".egg-info",
				 "installed-files.txt")
	if os.path.isfile(file_list_path): 
		file_list_dir = os.path.dirname(file_list_path) 
		package_info["files"] = [os.path.abspath(os.path.join(file_list_dir,line.strip())) for line in open(file_list_path)]
		package_info["files"] = filter(contains_legal_metadata,package_info["files"])

	
	# Need to resolve a circular dependency case here with some extra logic; for the moment it will hang in that case
	dependency_search_list = filter(has_been_seen,package.requires())
	packages_already_seen |= set([package.project_name.lower() for package in package.requires()])
	dependency_package_info_lists = list() 
	for dep in dependency_search_list: 
		dependency_package_info_lists.append(find_package_info(dep.project_name))
	dependency_package_info_lists = filter(None,dependency_package_info_lists)
	dependency_package_info = [dependency 
								for dep_list in dependency_package_info_lists
									for dependency in dep_list]

	packages_info_list = copy.deepcopy(dependency_package_info)
	packages_info_list.insert(0,package_info)
	
	return packages_info_list

def find_package_info_all(): 
	global packages_already_seen
	packages_info_lists = list()
	for package in installed_packages: 
		if package not in packages_already_seen: 
			packages_already_seen |= set([package])
			packages_info_lists.append(find_package_info(package))
	final_list = [pack 
					for packages_list in packages_info_lists
						for pack in packages_list]		
	return final_list

def warning(*objs): 
	print(*objs,file=sys.stderr) 

try: 
 input_argument = sys.argv[1]
except IndexError: 
	object_to_print = find_package_info_all()
else: 
	object_to_print = find_package_info(sys.argv[1])

if object_to_print is not None: 
	print(json.dumps(object_to_print),file=sys.stdout)
else: 
	warning("Package "+sys.argv[1]+" isn't installed.")


